from __future__ import annotations
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Dict, List
import json
import time

STATE_DIR = Path.home() / ".swarm"
RUNS_FILE = STATE_DIR / "runs.json"


@dataclass
class RunRecord:
    id: int
    run_type: str          # "local"
    repo_root: str
    branch: str
    created_at: float
    worktree_path: str | None = None
    commit: str | None = None
    notes: str | None = None


def _load() -> Dict[str, Any]:
    if not RUNS_FILE.exists():
        return {"repos": {}}
    with RUNS_FILE.open("r", encoding="utf-8") as f:
        return json.load(f)


def _save(data: Dict[str, Any]) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    with RUNS_FILE.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def add_run(repo_root: Path, rec: RunRecord) -> RunRecord:
    data = _load()
    key = str(repo_root)
    if key not in data["repos"]:
        data["repos"][key] = {"last_id": 0, "runs": []}
    store = data["repos"][key]
    store["last_id"] += 1
    rec.id = store["last_id"]
    store["runs"].append(asdict(rec))
    _save(data)
    return rec


def next_id(repo_root: Path) -> int:
    data = _load()
    key = str(repo_root)
    last = data["repos"].get(key, {}).get("last_id", 0)
    return last + 1


def get_run(repo_root: Path, id_: int) -> RunRecord | None:
    data = _load()
    key = str(repo_root)
    store = data["repos"].get(key)
    if not store:
        return None
    for r in store["runs"]:
        if r["id"] == id_:
            return RunRecord(**r)
    return None


def list_runs(repo_root: Path) -> List[RunRecord]:
    data = _load()
    key = str(repo_root)
    store = data["repos"].get(key, {"runs": []})
    return [RunRecord(**r) for r in store["runs"]]