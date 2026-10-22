import io,json
from math import gcd
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly
from fastapi import FastAPI,File,Form,UploadFile,HTTPException
from fastapi.responses import FileResponse
from model_engine import SyllableEngine,MODEL_ID
ROOT=Path(__file__).resolve().parent
app=FastAPI(title="Slabík",version="0.3.0")
engine=SyllableEngine()
lessons=json.loads((ROOT/"lessons.json").read_text(encoding="utf-8"))
@app.get("/")
def home():return FileResponse(ROOT/"index.html")
@app.get("/api/lessons")
def get_lessons():return lessons
@app.get("/api/status")
def status():return {"model":MODEL_ID,"loaded":engine.model is not None,"device":engine.device}
@app.post("/api/evaluate")
async def evaluate(audio:UploadFile=File(...),lesson_id:str=Form(...),index:int=Form(...)):
 lesson=next((x for x in lessons if x["id"]==lesson_id and x["enabled"]),None)
 if lesson is None or index<0 or index>=len(lesson["items"]):raise HTTPException(400,"Neplatná lekce nebo slabika")
 raw=await audio.read()
 if len(raw)>4000000:raise HTTPException(413,"Příliš velký soubor")
 try:data,rate=sf.read(io.BytesIO(raw),dtype="float32")
 except Exception:raise HTTPException(400,"Očekáván WAV")
 if data.ndim==2:data=data.mean(axis=1)
 if rate<8000 or rate>96000 or len(data)/rate>5:raise HTTPException(400,"Neplatná nahrávka")
 if len(data)/rate<.15 or float(np.sqrt(np.mean(data**2)))<.003:return {"status":"no_speech","note":"Hlas nebyl dostatečně slyšet"}
 if rate!=16000:
  d=gcd(rate,16000);data=resample_poly(data,16000//d,rate//d).astype("float32")
 target=lesson["items"][index]
 try:result=engine.evaluate(np.clip(data,-1,1),target,lesson["items"]+["má","ma","mé","me","le","lé","lo","ló","mo","mó","so","só","sa","sá","se","sé","la","lá"])
 except Exception as exc:raise HTTPException(503,"Nepodařilo se načíst model: "+str(exc)[:200])
 result.update(target=target,lesson_id=lesson_id,index=index)
 return result
