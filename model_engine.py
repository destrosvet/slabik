import os
import unicodedata
import numpy as np
import torch
from transformers import AutoProcessor, AutoModelForCTC

MODEL_ID = os.getenv("MODEL_ID", "mitkaj/w2v2BERT-CZ-CV-17.0")

def norm(text):
    return unicodedata.normalize("NFC", text).lower().strip()

class SyllableEngine:
    def __init__(self):
        self.model = None
        self.processor = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"

    def load(self):
        if self.model is None:
            processor = AutoProcessor.from_pretrained(MODEL_ID)
            model = AutoModelForCTC.from_pretrained(MODEL_ID).to(self.device).eval()
            self.processor = processor
            self.model = model

    @torch.inference_mode()
    def evaluate(self, samples, target, choices):
        self.load()
        inputs = self.processor(np.asarray(samples, dtype=np.float32), sampling_rate=16000, return_tensors="pt")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}
        logits = self.model(**inputs).logits
        transcript = self.processor.batch_decode(logits.argmax(-1).cpu())[0].strip()
        log_probs = logits.log_softmax(-1).transpose(0, 1)
        frames = log_probs.shape[0]
        blank = self.model.config.pad_token_id
        if blank is None:
            blank = self.processor.tokenizer.pad_token_id
        if blank is None:
            raise RuntimeError("CTC blank token not configured")

        rows = []
        for candidate in dict.fromkeys(map(norm, [target] + choices)):
            ids = self.processor.tokenizer(candidate, add_special_tokens=False).input_ids
            if not ids or len(ids) > frames or any(i == self.processor.tokenizer.unk_token_id for i in ids):
                continue
            loss = torch.nn.functional.ctc_loss(
                log_probs, torch.tensor([ids], device=self.device),
                torch.tensor([frames], device=self.device),
                torch.tensor([len(ids)], device=self.device),
                blank=int(blank), reduction="sum", zero_infinity=True
            )
            score = float(loss.item())
            if np.isfinite(score):
                rows.append((candidate, score))
        rows.sort(key=lambda x: x[1])
        if not rows:
            return {"status": "uncertain", "transcript": transcript, "candidates": [],
                    "note": "Nepodařilo se určit slabiku"}

        margin = rows[1][1] - rows[0][1] if len(rows) > 1 else 0.0
        # Conservative status only; not a clinically or pedagogically validated score.
        status = "likely_correct" if rows[0][0] == norm(target) and margin >= 1.5 else "uncertain"
        return {
            "status": status, "transcript": transcript, "best_match": rows[0][0],
            "margin": round(margin, 2),
            "candidates": [{"syllable": c, "nll": round(s, 2)} for c, s in rows[:5]],
            "note": "Orientační CTC porovnání. Správná délka samohlásky není ověřena."
        }
