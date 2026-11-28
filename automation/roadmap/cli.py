"""Roadmap file adapter. apply writes local state atomically; dry-run never writes."""
import argparse
import json
import os
import tempfile
from pathlib import Path
from engine import apply, blank, next_item, rank, reconcile

p = argparse.ArgumentParser()
p.add_argument("command", choices=("dry-run", "apply", "reconcile", "show"))
p.add_argument("--brand", choices=("cuai", "cai"), required=True)
p.add_argument("--state", type=Path, required=True)
p.add_argument("--events", type=Path)
p.add_argument("--comments", type=Path)
p.add_argument("--event-id")
p.add_argument("--fresh-complete", action="store_true", help="Use only after a complete authoritative issue read")
a = p.parse_args()
state = json.loads(a.state.read_text()) if a.state.exists() else blank(a.brand)
if state["brand"] != a.brand:
    p.error("brand/state mismatch")
if a.command in ("apply", "dry-run"):
    if not a.events:
        p.error("--events required")
    for event in json.loads(a.events.read_text()):
        state = apply(state, event)
elif a.command == "reconcile":
    if not a.comments or not a.event_id:
        p.error("--comments and --event-id required")
    state = reconcile(state, a.event_id, json.loads(a.comments.read_text()), fresh_complete=a.fresh_complete)
result = {"brand": a.brand, "next": next_item(state),
          "ranked": [{"id": i["id"], "score": rank(i), "stage": i["stage"]}
                     for i in sorted(state["items"].values(), key=lambda i: (-rank(i), i["id"]))],
          "outbox": state["outbox"]}
if a.command in ("apply", "reconcile"):
    a.state.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", dir=a.state.parent, delete=False) as f:
        json.dump(state, f, indent=2, sort_keys=True)
        f.write("\n")
        temp = f.name
    os.replace(temp, a.state)
print(json.dumps(result, indent=2, sort_keys=True))
