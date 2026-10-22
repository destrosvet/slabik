import io
import json
import threading
from math import gcd
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse

from model_engine import MODEL_ID, SyllableEngine

ROOT = Path(__file__).resolve().parent
app = FastAPI(title="Slabík", version="0.4.0")
engine = SyllableEngine()
inference_lock = threading.Lock()
lessons = json.loads((ROOT / "lessons.json").read_text(encoding="utf-8"))

@app.get("/")
def home():
    return FileResponse(ROOT / "index.html")

@app.get("/api/lessons")
def get_lessons():
    return lessons

@app.get("/api/status")
def status():
    return {"model": MODEL_ID, "loaded": engine.model is not None, "device": engine.device, "version": "0.4.0"}

def evaluate_sync(samples, target, candidates):
    # Serialize CPU inference to avoid concurrent model loads and RAM spikes.
    with inference_lock:
        return engine.evaluate(samples, target, candidates)

@app.post("/api/evaluate")
async def evaluate(audio: UploadFile = File(...), lesson_id: str = Form(...), index: int = Form(...)):
    lesson = next((l for l in lessons if l["id"] == lesson_id and l["enabled"]), None)
    if lesson is None or not 0 <= index < len(lesson["items"]):
        raise HTTPException(400, "Neplatná lekce nebo slabika")

    # Read one byte beyond the cap to reject oversized files without unbounded buffering.
    raw = await audio.read(4_000_001)
    if len(raw) > 4_000_000:
        raise HTTPException(413, "Nahrávka je příliš velká")
    try:
        data, rate = sf.read(io.BytesIO(raw), dtype="float32", always_2d=True)
    except Exception:
        raise HTTPException(400, "Očekáván zvukový soubor WAV")
    if rate < 8000 or rate > 96000 or not (0.15 <= len(data) / rate <= 5):
        raise HTTPException(400, "Nahrávka musí mít délku 0,15–5 sekund")
    data = data.mean(axis=1)
    if not np.all(np.isfinite(data)):
        raise HTTPException(400, "Neplatný zvuk")
    if float(np.sqrt(np.mean(data ** 2))) < 0.003:
        return {"status": "no_speech", "note": "Není slyšet dostatečně silný hlas"}
    if rate != 16000:
        d = gcd(rate, 16000)
        data = resample_poly(data, 16000 // d, rate // d).astype("float32")

    target = lesson["items"][index]
    candidates = lesson["items"] + ["má", "ma", "mé", "me", "le", "lé", "lo", "ló", "mo", "mó", "so", "só", "sa", "sá", "se", "sé", "la", "lá"]
    try:
        result = await run_in_threadpool(evaluate_sync, np.clip(data, -1, 1), target, candidates)
    except Exception:
        # Never disclose server internals or audio in public errors.
        raise HTTPException(503, "Model se nepodařilo spustit. Zkontrolujte serverové logy.")
    return {**result, "target": target, "lesson_id": lesson_id, "index": index}
