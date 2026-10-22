import os,unicodedata
import numpy as np
import torch
from transformers import AutoProcessor,AutoModelForCTC
MODEL_ID=os.getenv("MODEL_ID","mitkaj/w2v2BERT-CZ-CV-17.0")
def norm(s):return unicodedata.normalize("NFC",s).lower().strip()
class SyllableEngine:
 def __init__(self):self.model=None;self.processor=None;self.device="cuda" if torch.cuda.is_available() else "cpu"
 def load(self):
  if self.model is None:
   self.processor=AutoProcessor.from_pretrained(MODEL_ID)
   self.model=AutoModelForCTC.from_pretrained(MODEL_ID).to(self.device).eval()
 @torch.inference_mode()
 def evaluate(self,samples,target,choices):
  self.load()
  inputs=self.processor(np.asarray(samples,dtype=np.float32),sampling_rate=16000,return_tensors="pt")
  inputs={k:v.to(self.device) for k,v in inputs.items()}
  logits=self.model(**inputs).logits
  pred=self.processor.batch_decode(logits.argmax(-1).cpu())[0].strip()
  lp=logits.log_softmax(-1).transpose(0,1);n=lp.shape[0];blank=int(self.model.config.pad_token_id)
  rows=[]
  for c in dict.fromkeys(map(norm,[target]+choices)):
   ids=self.processor.tokenizer(c,add_special_tokens=False).input_ids
   if not ids or len(ids)>n or any(i==self.processor.tokenizer.unk_token_id for i in ids):continue
   loss=torch.nn.functional.ctc_loss(lp,torch.tensor([ids],device=self.device),torch.tensor([n],device=self.device),torch.tensor([len(ids)],device=self.device),blank=blank,reduction="sum",zero_infinity=True)
   rows.append((c,float(loss.item())))
  rows.sort(key=lambda x:x[1])
  if not rows:return {"status":"uncertain","transcript":pred,"candidates":[]}
  margin=rows[1][1]-rows[0][1] if len(rows)>1 else 0
  return {"status":"likely_correct" if rows[0][0]==norm(target) and margin>=1.5 else "uncertain","transcript":pred,"best_match":rows[0][0],"margin":round(margin,2),"candidates":[{"syllable":c,"nll":round(s,2)} for c,s in rows[:5]],"note":"CTC skóre je experimentální, délka samohlásky není samostatně měřena."}
