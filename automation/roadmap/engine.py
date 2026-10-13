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
OWNER = {"cuai": "existing development owner via Watney coordination", "cai": "existing CAI product/implementation owner"}
EVIDENCE = {
    "ranked": ("source", "observedAt", "finding"),
    "building": ("acceptedHandoff", "scope"),
    "qa": ("testCommand", "testResult", "artifactHash"),
    "blocked-release": ("gate", "releaseOwner"),
    "released": ("approvalId", "deploymentId"),
    "verified-complete": ("verification", "observedAt", "artifactHash"),
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


def apply(state, event):
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
            item["evidence"][eid] = evidence
            item["signals"] = event.get("signals", item["signals"])
        elif action == "override":
            choice = event.get("choice")
            if choice not in ("next", "defer", "reject", "clear") or not event.get("authority"):
                raise ValueError("explicit authority and choice required")
            item["override"] = None if choice == "clear" else choice
            if choice in ("defer", "reject"):
                if item in active(state):
                    raise ValueError("active work requires safe checkpoint before override")
                item["stage"] = "deferred" if choice == "defer" else "rejected"
            elif item["stage"] in ("deferred", "rejected"):
                item["stage"] = "idea"
            state["decisions"].append({"eventId": eid, "key": key, "choice": choice,
                                       "authority": event["authority"], "reason": event.get("reason")})
        elif action == "approval":
            scope = event.get("scope")
            if not scope or not event.get("authority") or not evidence.get("approvalId"):
                raise ValueError("approval needs exact scope and evidence")
            if not any(x["scope"] == scope and x["approvalId"] == evidence["approvalId"] for x in item["approvalScopes"]):
                item["approvalScopes"].append({"scope": scope, "approvalId": evidence["approvalId"],
                                               "authority": event["authority"]})
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
            if stage == "building" and item["stage"] == "ranked":
                if active(state):
                    raise ValueError("one active development item per brand")
                chosen = next_item(state)
                if chosen["id"] != key and not event.get("safeCheckpoint"):
                    raise ValueError("higher ranked Next exists; record safe checkpoint")
            if stage == "released":
                required = event.get("scope")
                if not required or not any(x["scope"] == required and x["approvalId"] == evidence["approvalId"]
                                           for x in item["approvalScopes"]):
                    raise ValueError("genuinely missing release authority")
            item["stage"] = stage
            item["history"].append({"eventId": eid, "stage": stage, "evidence": evidence})
            if stage in ("building", "blocked-release", "verified-complete"):
                state["outbox"][eid] = {"destination": BUS[state["brand"]], "status": "pending",
                                         "body": bus_comment(state, item, "handoff" if stage == "building" else "completion" if stage == "verified-complete" else "escalation", eid, evidence)}
        else:
            raise ValueError("unknown action")
    state["seenEvents"][eid] = fingerprint
    return state


def reconcile(state, event_id, remote_comments):
    """Read-only remote comments are needed before retrying an ambiguous post."""
    state = copy.deepcopy(state)
    entry = state["outbox"][event_id]
    matches = [x for x in remote_comments if f"eventId: {event_id}" in x]
    if len(matches) > 1 or (matches and matches[0] != entry["body"]):
        entry["status"] = "conflict"
    elif matches:
        entry["status"] = "confirmed"
    else:
        entry["status"] = "pending"
    return state
