# SongSift

**An end-to-end music workbench — analyze your library, get recommendations,
generate playlists by clustering, navigate a similarity graph, mashup two
tracks with beat-matched crossfades, and break down song lyrics with
sentiment + emotion analysis.**

Everything happens locally. Drop in your own MP3/WAV/FLAC files, and the
backend extracts a rich audio feature vector (tempo, key, spectral, MFCCs,
chromagrams) plus optional lyric features, then exposes them through a Flask
JSON API consumed by a React + TypeScript single-page app.

> Internally branded "TuneSift" in several modules — same project, two names.

---

## Highlights

- **Audio feature extraction** with librosa — tempo, beat times, chroma,
  MFCCs, spectral centroid, RMS energy, rolled-up "energy"/"mood" features
- **Three recommendation strategies** wired up side-by-side:
  - **Content-based** — cosine similarity on the engineered feature vector
  - **Collaborative filtering** — user × song rating matrix
  - **Hybrid** — content-based seeded by collaborative predictions, plus a
    mood-only mode
- **Clustering-based playlist generator** — KMeans on the feature matrix,
  with a 2-D visualization saved as PNG
- **Music similarity graph** built with NetworkX, with three different path
  algorithms:
  - Shortest path with minimum length
  - "Most diverse" path (maximize cumulative feature change)
  - "Smooth transition" path (minimize per-edge feature delta)
- **Mashup studio** — pitch shift + tempo adjust + beat-aligned crossfade for
  any two tracks, with preview rendering and a compatibility score
- **Playlist mix** — chains beat-matched transitions across an entire
  playlist into one continuous audio file
- **Lyric analysis** — fetches lyrics for a track, runs sentiment +
  emotion classification, saves visualizations
- **Live waveform / spectrum / chromagram / pitch / tempo plots** rendered
  on demand per song

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         React + Vite + TS                            │
│   chart.js · recharts · react-router · react-icons · jspdf           │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │ JSON over HTTP
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        Flask backend (app.py)                        │
│  /api/upload                     /api/recommend/{similar|collab|hybrid|mood}
│  /api/analyze/{id}               /api/playlists/{...}                │
│  /api/visualize/{id}/{feature}   /api/graph/{music-map|path|journey} │
│  /api/lyrics/{fetch|analyze}     /api/mashup/{analyze|preview|create}│
│  /api/beats/{analyze|transition} /api/users/{register|login|logout}  │
└────────────┬──────────────────────────────────────┬──────────────────┘
             │                                      │
             ▼                                      ▼
   ┌──────────────────────┐               ┌──────────────────────────┐
   │  Domain modules      │               │  Storage                 │
   │  analysis/           │               │  data/songs.json         │
   │  recommendation/     │               │  data/ratings.json       │
   │  clustering/         │               │  data/playlists.json     │
   │  graph/              │               │  data/mashups.json       │
   │  nlp/                │               │  uploads/<song>/         │
   │  audio/              │               │    audio + cover + plots │
   │  models/             │               │                          │
   └──────────────────────┘               └──────────────────────────┘
```

All persistence is **JSON-file-based** behind a thread-safe `DatabaseManager`
(`backend/database/db_manager.py`) with per-collection locks. No external
database to install — drop in audio, hit the API, done. Swappable for a real
DB later because every access goes through `db.find / find_one / insert_one /
update_one`.

---

## Repo layout

```
SongSift/
├── backend/
│   ├── app.py                      # Flask app — every route lives here
│   ├── analysis/
│   │   ├── audio_features.py       # librosa-based feature extraction
│   │   ├── waveform.py             # waveform PNG renderer
│   │   └── visualizations.py       # spectrum / chromagram / tempo / pitch
│   ├── recommendation/
│   │   ├── content_based.py
│   │   ├── collaborative.py
│   │   └── hybrid.py
│   ├── clustering/
│   │   ├── playlist_generator.py   # KMeans → named playlists
│   │   └── visualizations.py
│   ├── graph/
│   │   ├── music_graph.py          # NetworkX graph build + viz
│   │   └── path_finder.py          # 3 path types + musical-journey
│   ├── audio/
│   │   ├── mashup_generator.py     # pitch / tempo / crossfade
│   │   └── beat_matcher.py         # beat extraction + alignment + transitions
│   ├── nlp/
│   │   ├── lyric_fetcher.py
│   │   └── sentiment_analyzer.py
│   ├── models/                     # Song / User / Playlist domain models
│   ├── database/db_manager.py      # thread-safe JSON collection store
│   ├── utils/file_handlers.py
│   ├── templates/index.html
│   └── data/                       # JSON "collections" (gitignored)
└── frontend/
    ├── package.json                # React 18 · Vite · chart.js · recharts
    ├── vite.config.ts
    └── src/
        ├── App.tsx
        ├── components/             # UI primitives + visualizers
        ├── hooks/
        ├── services/               # typed API client
        ├── styling/
        ├── types/
        └── utils/
```

---

## Quick start

```bash
# --- Backend ---------------------------------------------------------------
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run dev server on http://localhost:5001
python app.py

# --- Frontend --------------------------------------------------------------
cd frontend
npm install
npm run dev   # http://localhost:5173 (proxies /api → :5001)
```

Open the frontend, upload a folder of audio files, and watch the rest of the
features populate as you click around.

### Audio formats

`.mp3`, `.wav`, `.ogg`, `.flac`, `.m4a`. Max upload size is 50 MB per file
(`MAX_CONTENT_LENGTH` in `backend/app.py`).

---

## API surface (selected)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/upload` | Multi-file upload; extracts metadata + features per file |
| `GET`  | `/api/songs` | List songs |
| `GET`  | `/api/analyze/{song_id}` | Re-run analysis |
| `GET`  | `/api/visualize/{song_id}/{feature}` | `waveform` · `spectrum` · `chromagram` · `tempo` · `pitch` |
| `GET`  | `/api/recommend/similar/{song_id}` | Content-based top-N |
| `GET`  | `/api/recommend/collaborative/{user_id}` | Collaborative filtering top-N |
| `GET`  | `/api/recommend/hybrid/{user_id}?seed_song_id=…` | Hybrid top-N |
| `GET`  | `/api/recommend/mood/{mood}` | Mood-based |
| `POST` | `/api/playlists/generate` | KMeans cluster a set of songs into N playlists |
| `POST` | `/api/playlists/create-transition` | Chain beat-matched transitions across the playlist |
| `GET`  | `/api/graph/music-map?threshold=` | Build similarity graph + return PNG |
| `GET`  | `/api/graph/path?source=&target=&type=&min_length=` | `shortest` · `diverse` · `smooth` |
| `GET`  | `/api/graph/journey?seed=&length=&diversity=` | Generate a musical journey |
| `POST` | `/api/mashup/analyze` | Compatibility score for two tracks |
| `POST` | `/api/mashup/preview` | Quick preview with pitch/tempo/crossfade |
| `POST` | `/api/mashup/create` | Persist a full mashup + visualization |
| `POST` | `/api/beats/analyze` | Tempo + beat timings |
| `POST` | `/api/beats/transition` | Beat-matched crossfade between two songs |
| `GET`  | `/api/lyrics/fetch?artist=&title=` | Fetch lyrics |
| `POST` | `/api/lyrics/analyze` | Sentiment + emotion + visualizations |
| `POST` | `/api/users/register` · `/login` · `/logout` | Sessions for collaborative filtering |
| `GET`  | `/api/health` | Liveness |

---

## Stack

| Concern | Library |
|---|---|
| Audio analysis | `librosa`, `numpy`, `soundfile` |
| Metadata extraction | `eyed3` (ID3 tags + embedded album art) |
| Modeling / clustering | `scikit-learn` (KMeans, cosine similarity, scalers) |
| Graph | `networkx` |
| Lyric NLP | `textblob` / `nltk` style pipeline |
| Plots | `matplotlib`, `seaborn` |
| API | `Flask`, `flask-cors`, `Werkzeug` |
| Frontend | React 18, Vite, TypeScript, chart.js + `react-chartjs-2`, recharts, react-router |

---

## Design notes

- **JSON-file persistence**: chose deliberately over SQLite for fast iteration
  during development. The `DatabaseManager` uses per-collection threading
  locks so concurrent writes from the Flask threads stay consistent. Migrating
  to SQLite/Postgres is a one-class swap because the read API is already
  collection-shaped (`find`, `find_one`, `insert_one`, `update_one`).
- **NaN scrubbing**: librosa occasionally returns `NaN` / `inf` from certain
  pitch / chroma estimations on quiet stretches; `clean_nan_values()` in
  `app.py` recursively normalizes outgoing JSON so the frontend never gets
  invalid numbers.
- **Two-tier graph fallback**: the music similarity graph uses a configurable
  `similarity_threshold`; when the resulting graph has no edges (small
  libraries with diverse songs), the API automatically retries with a lower
  threshold of `0.1` so visualizations remain meaningful instead of empty.
- **Two-pass tempo+pitch in mashups**: pitch-shifting on the temp-shifted
  file is layered before the tempo adjustment to keep the perceptual key
  consistent across the crossfade region.

---

## What's not here

- **Authentication is session-based and minimal** — fine for a local dev
  environment, not for production. Add JWT + HTTPS before deploying.
- **No streaming uploads** — files are buffered to disk before processing,
  which is why the cap is 50 MB.
- **DeepFace-style heavy ML models** are intentionally absent; everything
  here runs on a laptop CPU.
