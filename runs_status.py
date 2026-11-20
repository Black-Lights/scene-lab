"""
@file runs_status.py
@description Says, for every workflow run listed under "In flight" in docs/runs.md, whether it is still
running, was cut or has finished, and prints what is needed to resume a cut one.
Used by the scheduled check that starts cut runs again by themselves (docs/workflows.md).

How it knows: the output file of a run (tasks folder of the session, named in docs/runs.md) is empty while
the run works and gets its result when the run ends. A run that ended with an agent that is not "done", or with
a "stopped" result, was cut. It deliberately does not judge by how long an agent has been silent: an agent that
waits on a long render is silent and alive.

Usage: .venv\\Scripts\\python runs_status.py        one JSON line per run in flight
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent


def folder(text: str, label: str) -> pathlib.Path | None:
    m = re.search(r"^" + re.escape(label) + r":\s*\n?`([^`]+)`", text, re.M)
    return pathlib.Path(m.group(1)) if m else None


def main() -> int:
    runs = ROOT / "docs" / "runs.md"
    if not runs.exists():  # a fresh clone has no runs yet: nothing can be cut, which is not an error
        print(json.dumps({"in_flight": 0, "note": "docs/runs.md does not exist yet: no workflow run is listed "
                                                  "(docs/workflows.md says how to start it)"}))
        return 0
    text = runs.read_text("utf-8")
    session = folder(text, "Session folder (scripts and journals)")
    tasks = folder(text, "Task outputs")
    if "## In flight" not in text:
        print(json.dumps({"error": "docs/runs.md has no section 'In flight'"}))
        return 1
    section = text.split("## In flight", 1)[1].split("\n## ", 1)[0]
    blocks = re.split(r"^### ", section, flags=re.M)[1:]
    if not blocks:
        print(json.dumps({"in_flight": 0, "note": "nothing is in flight"}))
        return 0
    for block in blocks:
        name = block.split(":", 1)[0].strip()
        run_id = re.search(r"Run id `([^`]+)`", block)
        script = re.search(r"script `([^`]+)`", block)
        task = re.search(r"task id `([^`]+)`", block)
        row = {"run": name, "run_id": run_id.group(1) if run_id else None,
               "task_id": task.group(1) if task else None}
        if session and script:
            row["scriptPath"] = str(session / "workflows" / "scripts" / script.group(1))
        if session and run_id:
            journal = session / "subagents" / "workflows" / run_id.group(1) / "journal.jsonl"
            if journal.exists():
                started, done = {}, set()
                for line in journal.read_text("utf-8").splitlines():
                    try:
                        e = json.loads(line)
                    except ValueError:
                        continue
                    if e.get("type") == "started":
                        started[e.get("agentId")] = e.get("label")
                    elif e.get("type") == "result":
                        done.add(e.get("agentId"))
                row["finished"] = sorted({v for k, v in started.items() if k in done})
                row["unfinished"] = sorted({v for k, v in started.items() if k not in done} - {v for k, v in started.items() if k in done})
        out = tasks / (row["task_id"] + ".output") if tasks and row["task_id"] else None
        if out is None or not out.exists():
            row["state"] = "UNKNOWN"
            row["why"] = "no output file for this task id: the entry in docs/runs.md is incomplete, or the run belongs to another session"
        elif out.stat().st_size == 0:
            row["state"] = "RUNNING"
        else:
            try:
                d = json.loads(out.read_text("utf-8"))
            except ValueError:
                d = {}
            res = d.get("result")
            bad = [p.get("label") for p in d.get("workflowProgress", [])
                   if p.get("type") == "workflow_agent" and p.get("state") != "done"]
            stopped = res.get("stopped") if isinstance(res, dict) else None
            if bad or stopped or res is None:
                row["state"] = "CUT"
                row["why"] = stopped or ("agents not done: " + ", ".join(str(b) for b in bad) if bad else "the run ended without a result")
            else:
                row["state"] = "DONE"
        print(json.dumps(row))
    return 0


if __name__ == "__main__":
    sys.exit(main())
