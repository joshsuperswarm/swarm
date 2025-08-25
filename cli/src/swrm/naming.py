from __future__ import annotations
from datetime import datetime
import re

def slugify(text: str, max_len: int = 30) -> str:
    s = text.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s[:max_len] or "change"


def branch_name(prompt: str) -> str:
    ts = datetime.now().strftime("%Y%m%d-%H%M")
    return f"cc/{ts}-{slugify(prompt)}"