"""Fast repository checks that do not download the speech model."""
import json
import re
from pathlib import Path
root = Path(__file__).resolve().parents[1]
for name in ("server.py", "model_engine.py"):
    compile((root / name).read_text(encoding="utf-8"), name, "exec")
lessons = json.loads((root / "lessons.json").read_text(encoding="utf-8"))
assert len(lessons) >= 2
assert len(lessons[0]["items"]) == 25
assert lessons[0]["enabled"]
assert any("ó" in item.lower() for item in lessons[0]["items"])
assert any("é" in item.lower() for item in lessons[0]["items"])
html = (root / "index.html").read_text(encoding="utf-8")
for endpoint in ("/api/lessons", "/api/evaluate", "/api/status"):
    assert endpoint in html
script = re.search(r"<script>(.*?)</script>", html, re.S)
assert script, "Inline JS not found"
(root / ".slabik-js-check.js").write_text(script.group(1), encoding="utf-8")
print("Python syntax, lesson metadata and endpoint references: OK")
