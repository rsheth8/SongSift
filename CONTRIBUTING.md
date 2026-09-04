# Contributing to SongSift

## Prerequisites
- Python 3.10+
- Node.js (frontend)

## Run
Terminal 1:
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py          # :5001
```

Terminal 2:
```bash
cd frontend
npm install
npm run dev            # :5173, proxies /api
```

Drop your own MP3/WAV/FLAC. Max 50 MB/file.

## Notes
JSON file store, not Postgres. Auth is for local ratings only — not production-hardened.

Don't commit `backend/uploads/` or `backend/data/` libraries.
