# Slabík

Slabík je prototyp webové aplikace pro nácvik čtení českých slabik s experimentálním vyhodnocováním pomocí českého CTC akustického modelu.

## Funkce

- První lekce s 25 slabikami, včetně diakritiky.
- Jednoduché responzivní rozhraní pro dítě.
- Nahrávání zvuku z mikrofonu a zpracování na vlastním serveru.
- Automatická předběžná klasifikace slabiky a možnost rodičovského potvrzení.
- Pokrok ukládaný pro každou lekci zvlášť do localStorage.
- Připravený seznam pro další lekce v `lessons.json`.

## Lokální spuštění

Python 3.11:

```bash
pip install -r requirements.txt
uvicorn server:app --host 127.0.0.1 --port 8000
```

Otevřít http://localhost:8000. Model `mitkaj/w2v2BERT-CZ-CV-17.0` se poprvé stáhne z Hugging Face.

## Railway

Zdrojový repozitář: `destrosvet/slabik`. Railway používá `Dockerfile` a `railway.toml`, zdravotní kontrola: `/api/status`. Pro mikrofon na veřejné doméně je nutné HTTPS. Výpočet modelu může vyžadovat vyšší RAM a pomalejší první požadavek. Dosud není ověřeno sestavení produkčního image ani úspěšné načtení modelu na Railway.

## Bezpečnost, soukromí a omezení

- Hlas je odeslán backendu této aplikace, kde se dočasně zpracuje v paměti; aplikace ho záměrně nezapisuje do souboru ani databáze.
- Hostitel platformy má technicky přístup k provozu své infrastruktury. Model se jednorázově stahuje z Hugging Face, nahrávky se této službě neposílají.
- Skóre CTC není kalibrovaná pravděpodobnost ani validované hodnocení dětské výslovnosti.
- **Délka samohlásky se samostatně nevyhodnocuje**. Dvojice MO/MÓ mohou být chybně klasifikovány.
- V nejistých případech má přednost další pokus a rodičovské hodnocení.
- Bez ochrany před zneužitím a bez ověřených nákladů AI inference není vhodné provozovat neomezený veřejný přístup.
- V repo workflow jsou pouze syntaktické a konzistenční kontroly, nikoliv plný test AI inference.

## Vývoj

```bash
python scripts/smoke_check.py
node --check .slabik-js-check.js
```

## Herní režim (Kouzelný les)

`adventure.js` nyní zobrazuje paralaxní vrstvy lesa a dívku jako animovaný sprite atlas. Pro vykreslení skutečných sprite assetů umístěte exportované PNG soubory do kořenové složky `assets/` (veřejné URL `/assets/girl.png`, `/assets/forest1.png` až `/assets/forest5.png`). Scéna používá výhradně pixelové assety: vrstvený les, dlaždicovou cestu, stromy, trávu, lišku a světélko. Chybějící PNG ohlásí chybou načítání grafiky. Po úspěšné slabice vyšle kouzlo a postoupí, na konci otevře truhlu.

Runtime exporty použité touto hrou jsou v `assets/`, takže se při nasazení z GitHubu zahrnou do Docker image. Grafika je od GandalfHardcore a nepodléhá MIT licenci zdrojového kódu; není určena k samostatné redistribuci. Původní autorské balíčky v `sources/` zůstávají pouze lokálně a jsou vynechány z Gitu i Docker image.

## Docker Desktop

Spustit v kořeni projektu: `docker compose up --build -d`.
Otevřít http://localhost:8000. `docker compose logs -f` zobrazí průběh.
První start stahuje AI model a může trvat několik minut; `/api/ready` vrací 503, dokud není model připraven. `/api/status` kontroluje běh webu.
Model zůstává ve svazku `slabik_model-cache` i po `docker compose down`.
Zastavení: `docker compose down`. Port je dostupný pouze na tomto počítači.
Image používá Python 3.11 a CPU PyTorch, místní Python není potřeba.
Používané PNG jsou součástí `assets/` a Docker je při sestavení automaticky zkopíruje.

Kontroly: `python scripts/smoke_check.py`, `node scripts/frontend_check.cjs`, `docker compose exec -T slabik python scripts/api_check.py`.

Postava používá celý atlas složený z vrstev v `sources/` (idle, chůze, gesto kouzlení). Původ použitých exportů je v `assets/credits.json`. Prohlížečová kontrola `scripts/scene_check.cjs` vyžaduje Playwright a Edge; kontroluje také prázdné snímky animací.
