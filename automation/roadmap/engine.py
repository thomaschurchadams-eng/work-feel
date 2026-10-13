"""Deterministic, offline-first development roadmap reducer. No remote writes."""
from __future__ import annotations
import copy
import hashlib
import json
import re
from datetime import datetime, timezone

BRANDS = ("cuai", "cai")
KINDS = ("enhancement", "new-product", "data-asset", "evaluation", "model-asset")
STAGES = ("idea", "ranked", "building", "qa", "blocked-release", "released", "verified-complete", "deferred", "rejected")
TERMINAL = {"verified-complete", "deferred", "rejected"}
BUS = {"cuai": "thomaschurchadams-eng/work-feel#160", "cai": "thomaschurchadams-eng/cooperative-ai-institute-rebuild#12"}
OWNER = {"cuai": "cuai-operating-system", "cai": "chief-of-staff"}
ENABLED_OWNERS = {"cuai": {"cuai-operating-system", "daily-publisher", "reliability-watch"}, "cai": {"chief-of-staff"}}
EVIDENCE = {
    "ranked": ("source", "observedAt", "finding"),
    "building": ("acceptedHandoff", "acceptedBy", "scope", "sourceVersion"),
    "qa": ("testCommand", "testResult", "artifactHash", "commitSha", "sourceVersion"),
    "blocked-release": ("gate", "releaseOwner"),
    "released": ("approvalId", "deploymentId", "commitSha", "artifactHash", "sourceVersion", "actionClass", "observedAt", "rollbackOwner", "rollbackSteps"),
    "verified-complete": ("verification", "observedAt", "artifactHash", "commitSha", "environment", "deploymentId"),
}


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def slug(value):
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def blank(brand):
    if brand not in BRANDS:
        raise ValueError("unknown brand")
    return {"schema": 1, "brand": brand, "items": {}, "seenEvents": {}, "outbox": {}, "decisions": []}


def require_evidence(stage, evidence):
    missing = [k for k in EVIDENCE.get(stage, ()) if not evidence.get(k)]
    if missing:
        raise ValueError("missing stage evidence: " + ", ".join(missing))


def active(state):
    return [v for v in state["items"].values() if v["stage"] in ("building", "qa", "blocked-release", "released")]


def rank(item):
    if item["stage"] in TERMINAL:
        return -1
    if item.get("override") == "next":
        return 10000
    signals = item.get("signals", {})
    return sum(int(signals.get(k, 0)) * weight for k, weight in
               (("goal", 5), ("user", 4), ("evidence", 3), ("urgency", 2), ("effort", -1)))


def next_item(state):
    if active(state):
        return None
    items = [v for v in state["items"].values() if v["stage"] in ("idea", "ranked")]
    return min(items, key=lambda x: (-rank(x), x["id"])) if items else None


def bus_comment(state, item, kind, event_id, evidence):
    return "\n".join((f"eventId: {event_id}", f"eventType: {kind}",
                      "from: roadmap-adapter", f"to: {item['owner']}",
                      f"goalId: {item.get('goalId') or 'unassigned'}", "priority: normal",
                      f"objective: {item['title']}", f"dedupeKey: roadmap:{state['brand']}:{item['id']}",
                      f"status: {item['stage']}", f"evidence: {json.dumps(evidence, sort_keys=True)}",
                      f"tomApprovalRequired: {'yes' if item['stage'] == 'blocked-release' else 'no'}",
                      f"nextOwner: {item['owner']}"))


def apply(state, event, approval_verifier=None, handoff_verifier=None, checkpoint_verifier=None, qa_verifier=None, deployment_verifier=None):
    """Pure reducer. A repeated event is a no-op; conflicting identity fails closed."""
    state = copy.deepcopy(state)
    if state["brand"] not in BRANDS:
        raise ValueError("unknown brand")
    eid = event["eventId"]
    fingerprint = digest(event)
    if eid in state["seenEvents"]:
        if state["seenEvents"][eid] != fingerprint:
            raise ValueError("eventId collision: reconcile source")
        return state
    action = event["action"]
    key = slug(event.get("key", ""))
    evidence = event.get("evidence", {})
    if action == "intake":
        if not key or not event.get("title") or event.get("kind") not in KINDS:
            raise ValueError("intake requires stable key, title, kind")
        if (event.get("owner") or OWNER[state["brand"]]) not in ENABLED_OWNERS[state["brand"]]:
            raise ValueError("owner is not an enabled existing role")
        if key in state["items"]:
            item = state["items"][key]
            if item["kind"] != event["kind"]:
                raise ValueError("semantic key conflict: reconcile")
            item["sources"] = sorted(set(item["sources"] + event.get("sources", [])))
        else:
            state["items"][key] = {"id": key, "title": event["title"], "kind": event["kind"],
                "stage": "idea", "sources": sorted(set(event.get("sources", []))),
                "owner": event.get("owner") or OWNER[state["brand"]], "goalId": event.get("goalId"),
                "signals": event.get("signals", {}), "evidence": {}, "history": [], "override": None,
                "approvalScopes": []}
        item = state["items"][key]
    else:
        if key not in state["items"]:
            raise ValueError("unknown item")
        item = state["items"][key]
        if action == "evidence":
            if not evidence.get("source") or not evidence.get("observedAt"):
                raise ValueError("dated source required")
            latest = max((v["observedAt"] for v in item["evidence"].values()), default="")
            item["evidence"][eid] = evidence
            if evidence["observedAt"] >= latest:
                item["signals"] = event.get("signals", item["signals"])
        elif action == "override":
            choice = event.get("choice")
            if choice not in ("next", "defer", "reject", "clear") or not event.get("authority"):
                raise ValueError("explicit authority and choice required")
            item["override"] = None if choice == "clear" else choice
            if choice in ("defer", "reject"):
                if item in active(state):
                    receipt = checkpoint_verifier(event) if checkpoint_verifier else None
                    if not isinstance(receipt, dict) or any(receipt.get(k) != v for k, v in
                        (("itemKey", key), ("owner", item["owner"]), ("status", "accepted"))):
                        raise ValueError("active work requires authoritative safe checkpoint")
                    if not receipt.get("source") or not receipt.get("sourceVerified") or not receipt.get("artifactHash") or receipt.get("recoveryOwner") not in ENABLED_OWNERS[state["brand"]]:
                        raise ValueError("checkpoint lacks verified recovery evidence")
                    item["history"].append({"eventId": eid, "stage": "safe-checkpoint", "evidence": receipt})
                item["stage"] = "deferred" if choice == "defer" else "rejected"
                item["history"].append({"eventId": eid, "stage": item["stage"], "evidence": {"authority": event["authority"], "reason": event.get("reason")}})
            elif item["stage"] in ("deferred", "rejected"):
                item["stage"] = "idea"
            state["decisions"].append({"eventId": eid, "key": key, "choice": choice,
                                       "authority": event["authority"], "reason": event.get("reason")})
        elif action == "approval":
            if approval_verifier is None:
                raise ValueError("approval requires authoritative source verification")
            receipt = approval_verifier(event)
            fields = ("approvalId", "source", "authority", "scope", "actionClass", "itemKey", "artifactHash", "commitSha", "sourceVersion", "status")
            if not isinstance(receipt, dict) or any(not receipt.get(k) for k in fields):
                raise ValueError("unverified approval receipt")
            if receipt["status"] != "active" or receipt["authority"] != "Tom":
                raise ValueError("approval is not active Tom authority")
            if receipt["scope"] != event.get("scope") or receipt["approvalId"] != evidence.get("approvalId") or receipt["itemKey"] != key or receipt["actionClass"] != event.get("actionClass"):
                raise ValueError("approval source differs from requested item, action, scope or ID")
            if not receipt.get("sourceVerified"):
                raise ValueError("unverified approval source")
            qa = next((h["evidence"] for h in reversed(item["history"]) if h["stage"] == "qa"), None)
            if not qa or any(receipt[k] != qa[k] for k in ("artifactHash", "commitSha", "sourceVersion")):
                raise ValueError("approval differs from tested artifact")
            if receipt.get("expiresAt") and receipt["expiresAt"] <= max(event.get("observedAt", ""), datetime.now(timezone.utc).date().isoformat()):
                raise ValueError("approval expired")
            if not any(x["approvalId"] == receipt["approvalId"] for x in item["approvalScopes"]):
                item["approvalScopes"].append(receipt)
        elif action == "revoke-approval":
            if approval_verifier is None:
                raise ValueError("revocation requires authoritative source verification")
            receipt = approval_verifier(event)
            matches = [x for x in item["approvalScopes"] if x["approvalId"] == receipt.get("approvalId")]
            if not matches or receipt.get("status") != "revoked" or not receipt.get("source") or not receipt.get("sourceVerified"):
                raise ValueError("unverified approval revocation")
            for prior in matches:
                prior["status"] = "revoked"
                prior["revocationSource"] = receipt["source"]
        elif action == "transition":
            stage = event.get("stage")
            if stage not in STAGES:
                raise ValueError("invalid stage")
            allowed = {"idea": {"ranked"}, "ranked": {"building"}, "building": {"qa"},
                       "qa": {"building", "blocked-release"}, "blocked-release": {"released", "building"},
                       "released": {"verified-complete", "blocked-release"}}
            if stage not in allowed.get(item["stage"], set()):
                raise ValueError("unsafe stage transition")
            require_evidence(stage, evidence)
            if stage == "building":
                if evidence["acceptedBy"] != item["owner"]:
                    raise ValueError("receiving owner must accept handoff")
                receipt = handoff_verifier(event) if handoff_verifier else None
                if not isinstance(receipt, dict) or any(receipt.get(k) != v for k, v in
                    (("itemKey", key), ("owner", item["owner"]), ("receiptId", evidence["acceptedHandoff"]), ("actionClass", "build"), ("sourceVersion", evidence["sourceVersion"]), ("status", "accepted"))):
                    raise ValueError("handoff needs authoritative receiving-owner receipt")
                if not receipt.get("source") or not receipt.get("sourceVerified"):
                    raise ValueError("unverified handoff source")
                if item["stage"] == "ranked":
                    if active(state):
                        raise ValueError("one active development item per brand")
                    chosen = next_item(state)
                    if chosen["id"] != key and not event.get("safeCheckpoint"):
                        raise ValueError("higher ranked Next exists; record safe checkpoint")
            if stage == "qa":
                if evidence["testResult"] != "passed":
                    raise ValueError("failed QA cannot advance")
                build = next((h["evidence"] for h in reversed(item["history"]) if h["stage"] == "building"), None)
                if not build or evidence["sourceVersion"] != build["sourceVersion"]:
                    raise ValueError("QA source version differs from accepted handoff")
                result = qa_verifier(event) if qa_verifier else None
                if not isinstance(result, dict) or not result.get("sourceVerified") or not result.get("source") or any(result.get(k) != evidence[k] for k in ("testCommand", "testResult", "artifactHash", "commitSha", "sourceVersion")):
                    raise ValueError("QA needs verified exact-version test receipt")
            if stage == "verified-complete":
                qa = next((h["evidence"] for h in reversed(item["history"]) if h["stage"] == "qa"), None)
                if not qa or any(evidence[k] != qa[k] for k in ("artifactHash", "commitSha")):
                    raise ValueError("final artifact differs from tested QA version")
                if evidence["environment"] != "production":
                    raise ValueError("preview cannot verify production completion")
                release = next((h["evidence"] for h in reversed(item["history"]) if h["stage"] == "released"), None)
                if not release or any(evidence[k] != release[k] for k in ("deploymentId", "commitSha", "artifactHash")):
                    raise ValueError("completion differs from released deployment")
                production = deployment_verifier(event) if deployment_verifier else None
                if not isinstance(production, dict) or not production.get("sourceVerified") or not production.get("source") or any(production.get(k) != evidence[k] for k in ("deploymentId", "commitSha", "artifactHash", "environment")):
                    raise ValueError("completion needs authoritative production receipt")
            if stage == "released":
                required = event.get("scope")
                qa = next((h["evidence"] for h in reversed(item["history"]) if h["stage"] == "qa"), None)
                if not qa or any(evidence[k] != qa[k] for k in ("artifactHash", "commitSha", "sourceVersion")):
                    raise ValueError("release differs from tested artifact")
                fresh = approval_verifier(event) if approval_verifier else None
                if not isinstance(fresh, dict) or not fresh.get("sourceVerified") or fresh.get("status") != "active" or fresh.get("authority") != "Tom":
                    raise ValueError("release needs fresh authoritative approval")
                if not required or not any(x["scope"] == required and x["approvalId"] == evidence["approvalId"]
                                           and x["artifactHash"] == evidence["artifactHash"]
                                           and x["commitSha"] == evidence["commitSha"]
                                           and x["sourceVersion"] == evidence["sourceVersion"]
                                           and x["actionClass"] == evidence["actionClass"]
                                           and x["itemKey"] == key
                                           and x["status"] == "active"
                                           and all(fresh.get(k) == x.get(k) for k in ("approvalId", "source", "scope", "actionClass", "itemKey", "artifactHash", "commitSha", "sourceVersion"))
                                           and (not fresh.get("expiresAt") or fresh["expiresAt"] > max(evidence["observedAt"], datetime.now(timezone.utc).date().isoformat()))
                                           and (not x.get("expiresAt") or x["expiresAt"] > max(evidence["observedAt"], datetime.now(timezone.utc).date().isoformat()))
                                           for x in item["approvalScopes"]):
                    raise ValueError("genuinely missing release authority")
                deployment = deployment_verifier(event) if deployment_verifier else None
                if not isinstance(deployment, dict) or not deployment.get("sourceVerified") or not deployment.get("source") or any(deployment.get(k) != evidence[k] for k in ("deploymentId", "commitSha", "artifactHash")):
                    raise ValueError("release needs authoritative deployment receipt")
            item["stage"] = stage
            item["history"].append({"eventId": eid, "stage": stage, "evidence": evidence})
            if stage in ("building", "blocked-release", "verified-complete"):
                state["outbox"][eid] = {"destination": BUS[state["brand"]], "status": "pending",
                                         "body": bus_comment(state, item, "handoff" if stage == "building" else "completion" if stage == "verified-complete" else "escalation", eid, evidence)}
        else:
            raise ValueError("unknown action")
    state["seenEvents"][eid] = fingerprint
    return state


def reconcile(state, event_id, remote_comments, fresh_complete=False, recovery_receipt=None, recovery_verifier=None):
    """Never downgrade a known receipt from a stale or partial issue read."""
    state = copy.deepcopy(state)
    entry = state["outbox"][event_id]
    if recovery_receipt:
        verified = recovery_verifier(recovery_receipt) if recovery_verifier else None
        expected_key = re.search(r"(?m)^dedupeKey: (.+)$", entry["body"]).group(1)
        expected_owner = re.search(r"(?m)^nextOwner: (.+)$", entry["body"]).group(1)
        if not isinstance(verified, dict) or any(verified.get(k) != v for k,v in
            (("eventId",event_id),("dedupeKey",expected_key),("owner",expected_owner),
             ("bodyHash",digest(entry["body"])),("priorStatus",entry["status"]),("status","resolved"))):
            raise ValueError("invalid authoritative recovery receipt")
        if not verified.get("sourceVerified") or not verified.get("source") or verified.get("observedAt", "") < datetime.now(timezone.utc).date().isoformat():
            raise ValueError("recovery receipt not fresh or verified")
        entry["status"] = "confirmed" if verified.get("posted") else "pending"
        entry["recoverySource"] = verified["source"]
        return state
    if not fresh_complete:
        if entry["status"] == "pending":
            entry["status"] = "uncertain"
        return state
    expected_key = re.search(r"(?m)^dedupeKey: (.+)$", entry["body"]).group(1)
    matches = []
    for body in remote_comments:
        event_match = re.search(r"(?m)^eventId: ([^\r\n]+)$", body)
        key_match = re.search(r"(?m)^dedupeKey: ([^\r\n]+)$", body)
        if event_match and event_match.group(1) == event_id and key_match and key_match.group(1) == expected_key:
            matches.append(body)
    if len(matches) > 1 or (matches and matches[0] != entry["body"]):
        entry["status"] = "conflict"
    elif matches and entry["status"] != "conflict":
        entry["status"] = "confirmed"
    elif entry["status"] not in ("confirmed", "conflict"):
        entry["status"] = "pending"
    return state
