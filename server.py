import asyncio
import logging
import os
from contextlib import asynccontextmanager
import hashlib
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
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from model_engine import MODEL_ID, SyllableEngine

ROOT = Path(__file__).resolve().parent
asset_digest = hashlib.sha256((ROOT / "adventure.js").read_bytes())
for asset_path in sorted((ROOT / "assets").glob("*.png")):
    asset_digest.update(asset_path.name.encode())
    asset_digest.update(asset_path.read_bytes())
ASSET_VERSION = asset_digest.hexdigest()[:12]
logger = logging.getLogger("uvicorn.error")
model_task = None

async def preload_model():
    try:
        await run_in_threadpool(engine.load)
    except Exception:
        logger.exception("Speech model preload failed")

@asynccontextmanager
async def lifespan(app):
    global model_task
    if os.getenv("PRELOAD_MODEL", "0") == "1":
        model_task = asyncio.create_task(preload_model())
    yield
    if model_task and not model_task.done():
        model_task.cancel()

app = FastAPI(title="Slabík", version="0.4.0", lifespan=lifespan)
(ROOT / "assets").mkdir(exist_ok=True)
app.mount("/assets", StaticFiles(directory=ROOT / "assets"), name="assets")
engine = SyllableEngine()
inference_lock = threading.Lock()
lessons = json.loads((ROOT / "lessons.json").read_text(encoding="utf-8"))

@app.get("/")
def home():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    html = html.replace('/adventure.js"', f'/adventure.js?v={ASSET_VERSION}"')
    return HTMLResponse(html, headers={"Cache-Control": "no-store"})

@app.get("/adventure.js")
def adventure_script():
    return FileResponse(ROOT / "adventure.js", media_type="text/javascript", headers={"Cache-Control": "no-cache"})

@app.get("/api/lessons")
def get_lessons():
    return lessons

@app.get("/api/status")
def status():
    return {"model": MODEL_ID, "loaded": engine.model is not None, "device": engine.device, "version": "0.4.0", "assets_version": ASSET_VERSION}

@app.get("/api/ready")
def ready():
    if engine.model is None:
        raise HTTPException(503, "Model zatím není připraven")
    return {"ready": True}


def evaluate_sync(samples, target, candidates):
    # Serialize CPU inference to avoid concurrent model loads and RAM spikes.
    if not inference_lock.acquire(blocking=False):
        raise HTTPException(429, "Server právě vyhodnocuje jinou nahrávku. Zkuste to znovu.", headers={"Retry-After": "3"})
    try:
        if model_task and not model_task.done():
            raise HTTPException(503, "Model se připravuje. Zkuste to za chvíli.", headers={"Retry-After": "10"})
        return engine.evaluate(samples, target, candidates)
    finally:
        inference_lock.release()

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
        with sf.SoundFile(io.BytesIO(raw)) as recording:
            if recording.format != "WAV" or recording.channels > 2 or not 8000 <= recording.samplerate <= 96000 or not 0.15 <= recording.frames / recording.samplerate <= 5:
                raise ValueError("Invalid WAV metadata")
            rate = recording.samplerate
            data = recording.read(dtype="float32", always_2d=True)
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
    except HTTPException:
        raise
    except Exception:
        logger.exception("Speech evaluation failed")
        # Never disclose server internals or audio in public errors.
        raise HTTPException(503, "Model se nepodařilo spustit. Zkontrolujte serverové logy.")
    return {**result, "target": target, "lesson_id": lesson_id, "index": index}
