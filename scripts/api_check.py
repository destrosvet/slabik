"""Run inside the application container, without extra test dependencies."""
import io
import json
import urllib.request
import urllib.error
import wave

BASE = "http://127.0.0.1:8000"

def get(path):
    with urllib.request.urlopen(BASE + path, timeout=10) as response:
        return response.read()

assert b"Slab" in get("/")
assert json.loads(get("/api/lessons"))[0]["enabled"]
assert "model" in json.loads(get("/api/status"))
assert get("/assets/girl.png").startswith(b"\x89PNG")

def submit(raw, expected):
    boundary = "slabik-check-boundary"
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"lesson_id\"\r\n\r\nomls-01\r\n"
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"index\"\r\n\r\n0\r\n"
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"audio\"; filename=\"test.wav\"\r\nContent-Type: audio/wav\r\n\r\n").encode() + raw + f"\r\n--{boundary}--\r\n".encode()
    request = urllib.request.Request(BASE + "/api/evaluate", data=body, headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            assert response.status == expected
            return json.load(response)
    except urllib.error.HTTPError as error:
        assert error.code == expected, error.read()

submit(b"invalid", 400)
buf = io.BytesIO()
with wave.open(buf, "wb") as audio:
    audio.setnchannels(1)
    audio.setsampwidth(2)
    audio.setframerate(16000)
    audio.writeframes(bytes(16000 * 2))
assert submit(buf.getvalue(), 200)["status"] == "no_speech"
print("HTTP pages, assets, lessons, status, invalid WAV and silence: OK")

# Optional real-model smoke test. A synthetic tone checks execution, not recognition quality.
if "--inference" in __import__("sys").argv:
    import math
    import struct
    buf = io.BytesIO()
    with wave.open(buf, "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(16000)
        audio.writeframes(b"".join(struct.pack("<h", int(1000 * math.sin(2 * math.pi * 220 * i / 16000))) for i in range(16000)))
    result = submit(buf.getvalue(), 200)
    assert result["status"] in ("uncertain", "likely_correct")
    assert result["target"] == "MO"
    assert result["candidates"], result
    print("Real model inference on synthetic audio: OK", result["status"])
