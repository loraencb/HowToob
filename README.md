# OOP-Team-B_Youtube-lite

A learning-platform MVP with a Flask backend and a React frontend.

## Repo Layout

```text
OOP-Team-B_Youtube-lite/
|-- frontend/          # React client (Vite)
|-- backend/
|   |-- src/
|   |   `-- app/       # Flask API package
|   |       |-- models/    # SQLAlchemy models
|   |       |-- routes/    # Flask blueprints
|   |       |-- services/  # Business logic
|   |       `-- utils/     # Shared helpers
|   `-- tests/         # Backend API tests
|-- scripts/           # Seed/admin utilities
|-- uploads/           # Generated video and thumbnail assets
|-- docs/              # Supporting project docs
|-- run.py             # Backend entry point
`-- requirements.txt   # Python dependencies
```

## Source Of Truth

- The active backend lives in `backend/src/app`.
- The active frontend lives in `frontend`.
- Backend modules are organized by `models`, `routes`, `services`, and `utils`.

## Quick Start

```bash
pip install -r requirements.txt
python run.py
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Tests:

```bash
pytest
```

## Database Migrations

HowToob now includes Flask-Migrate/Alembic scaffolding for the backend.

### Install dependencies

```bash
pip install -r requirements.txt
```

`FLASK_APP=run.py` is already configured in the repo `.env`, so the Flask CLI can discover the app.

### Migration setup

The repo already includes an initialized `migrations/` directory and an initial migration reflecting the current models, including `users.role`.

Typical commands:

```bash
flask db upgrade
flask db migrate -m "add new field"
flask db upgrade
```

If you ever need to create the migration repository from scratch on a brand-new clone, the command is:

```bash
flask db init
```

### Typical workflow

When you change SQLAlchemy models:

```bash
flask db migrate -m "describe schema change"
flask db upgrade
```

### Dev note

- For an existing local database that already matches the current schema but has no Alembic history yet, use:

```bash
flask db stamp head
```

- If the local SQLite file has broader drift, bad seed data, or you do not care about preserving it, deleting the DB in development is still acceptable.
- The older startup `ensure_schema_updates()` patching remains as a deprecated safety net for local SQLite dev databases, but migrations are the preferred path going forward.

## SQLite Dev Database Note

If your local SQLite database was created before newer columns were added, the app can
hit errors such as `sqlite3.OperationalError: no such column: users.role` during login
or `sqlite3.OperationalError: no such column: subscriptions.tier_level` when loading
subscription data.

For local development, startup now self-heals older SQLite databases by patching a few
known schema gaps in place. In particular, if the `users.role` column is missing, the
app adds it automatically on startup and backfills existing rows to `viewer`. If the
`subscriptions.tier_level` column is missing, the app also adds it automatically and
backfills existing rows to tier `0`.

This patching is idempotent, so repeated runs stay safe. Deleting the local SQLite file
is still acceptable in development if your database has broader schema drift or test data
you no longer need, but it should no longer be necessary for the `users.role` or
`subscriptions.tier_level` mismatch crashes.

## AI Quiz Generation

HowToob now includes an on-demand backend path for generating quiz definitions from uploaded lesson media, plus an optional auto-generate-on-upload mode for creator workflows.

Current MVP shape:

- creators and admins can call `POST /videos/<video_id>/quiz/generate`
- the backend transcribes the uploaded lesson file first, then asks the model for a structured quiz definition
- the generator can now combine the lesson transcript with sampled video frames, so on-screen diagrams, code, and visual demonstrations can influence the quiz too
- generated questions are saved as a normal `QuizDefinition`, so the existing learner quiz flow keeps working
- if enabled, the upload route can automatically generate a quiz after saving the lesson file
- transcripts are cached per video so repeat generation does not re-transcribe unchanged lesson files
- larger lesson files can be split into audio chunks with `ffmpeg` before transcription

Environment variables:

```env
OPENAI_API_KEY=
OPENAI_API_BASE_URL=https://api.openai.com/v1
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
OPENAI_QUIZ_MODEL=gpt-4o-mini
QUIZ_AI_DEFAULT_QUESTION_COUNT=10
QUIZ_AI_MIN_TRANSCRIPT_CHARS=30
QUIZ_AI_MAX_TRANSCRIPT_CHARS=12000
QUIZ_AI_INCLUDE_VIDEO_FRAMES=true
QUIZ_AI_FRAME_SAMPLE_COUNT=4
QUIZ_AI_FRAME_WIDTH=768
QUIZ_AI_AUTO_GENERATE_ON_UPLOAD=false
QUIZ_AI_AUTO_GENERATE_QUESTION_COUNT=10
QUIZ_AI_CHUNK_SECONDS=600
QUIZ_AI_AUDIO_BITRATE_KBPS=64
QUIZ_AI_FFMPEG_BINARY=ffmpeg
```

Example request:

```bash
curl -X POST http://localhost:5000/videos/12/quiz/generate \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"question_count": 10}'
```

Current dev limitations:

- the generator needs `OPENAI_API_KEY` configured on the backend
- it works against the uploaded lesson file already stored on disk
- the quiz prompt still uses a trimmed transcript window before generation
- sampled video frames are attached as image inputs when frame extraction is available, which helps with visual lessons that rely on diagrams or on-screen text
- transcript chunking for larger lesson files requires `ffmpeg` to be available on the host machine
- if a lesson already has a stored quiz definition, pass `overwrite=true` to replace it

Upload behavior:

- `POST /videos/upload` still succeeds even if AI quiz generation fails
- when auto-generation is enabled, the upload response now includes a `quiz_generation` object with `generated`, `failed`, or `skipped` status details

Deleting or editing a generated quiz is still handled through the existing quiz-definition path.

## LAN Development

Use these settings when one PC is hosting the app and other devices on the same Wi-Fi need access.

### 1. Find the host machine IP

On Windows, run:

```powershell
ipconfig
```

Use the IPv4 address from your active Wi-Fi adapter, for example `192.168.1.50`.

### 2. Backend

`run.py` now reads `HOST`, `PORT`, and `DEBUG` from environment variables, with LAN-friendly defaults:

- `HOST=0.0.0.0`
- `PORT=5000`
- `DEBUG=true`

Optional backend environment variables:

- `LAN_IP=192.168.1.50`
- `CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://192.168.1.50:5173`
- `CORS_ALLOW_ALL_DEV=true`
- `SESSION_COOKIE_SAMESITE=Lax`
- `SESSION_COOKIE_SECURE=false`
- `SERVE_FRONTEND_BUILD=false`

For same-Wi-Fi login reliability, keep the frontend and backend on the same LAN host:

- frontend URL: `http://<LAN_IP>:5173`
- backend URL: `http://<LAN_IP>:5000`

Using the same LAN IP on both sides keeps Flask session cookies same-site in development, so `credentials: include` continues to work over HTTP without requiring `Secure` cookies.

Run the backend from the project root:

```powershell
$env:HOST="0.0.0.0"
$env:PORT="5000"
$env:DEBUG="true"
$env:CORS_ALLOW_ALL_DEV="true"
venv\Scripts\python.exe run.py
```

Backend URL:

```text
http://<LAN_IP>:5000
```

### 3. Frontend

The frontend supports `VITE_API_BASE_URL` for direct backend calls and exposes the Vite dev server on the network.

Recommended `frontend/.env.local`:

```env
VITE_API_BASE_URL=http://<LAN_IP>:5000
```

Run the frontend:

```powershell
cd frontend
$env:VITE_API_BASE_URL="http://<LAN_IP>:5000"
npm run dev
```

Frontend URL:

```text
http://<LAN_IP>:5173
```

Teammates on the same Wi-Fi should open:

```text
http://<LAN_IP>:5173
```

### 4. Firewall and troubleshooting

When Windows prompts for Python or Node access, allow **Private networks**.

If another laptop or phone cannot connect:

1. Confirm both devices are on the same Wi-Fi, not guest Wi-Fi vs main Wi-Fi.
2. Re-run `ipconfig` and use the IPv4 address from the active Wi-Fi adapter, not Ethernet, VPN, or a virtual adapter.
3. Make sure the host can open both URLs locally:
   `http://localhost:5000` and `http://localhost:5173`
4. Make sure the other device uses the LAN IP, never `localhost`.
5. Temporarily allow ports `5000` and `5173` through the Windows firewall for private networks.
6. If login fails but pages load, make sure `VITE_API_BASE_URL` uses the same `http://<LAN_IP>:5000` origin shown in the browser, not `localhost`.
7. If phones are especially finicky, use single-URL mode below so the app runs from one origin.

### 5. Optional single-URL mode

Build the frontend and let Flask serve `frontend/dist`:

```powershell
cd frontend
npm run build
cd ..
$env:SERVE_FRONTEND_BUILD="true"
venv\Scripts\python.exe run.py
```

Single app URL:

```text
http://<LAN_IP>:5000
```

This is the simplest demo mode for phones and other real devices because it avoids cross-origin cookie and CORS edge cases.

### 6. LAN demo checklist

1. On the host PC, run `ipconfig` and note the active Wi-Fi IPv4 address.
2. Start the backend on `0.0.0.0:5000`.
3. Start the frontend on `0.0.0.0:5173`, or build it and enable `SERVE_FRONTEND_BUILD=true`.
4. On another device, open `http://<LAN_IP>:5173` or `http://<LAN_IP>:5000` in single-URL mode.
5. Log in on that device directly and verify a protected page loads after refresh.
6. Open a lesson, check progress sync, and confirm uploads/streaming work from the host machine.
7. If anything fails, check firewall prompts, same-Wi-Fi status, and that both frontend and backend use the same LAN IP.

Known development limits:

- HTTP LAN mode is for demos only; it is not a production deployment.
- If a device changes networks, the current session may need a fresh login.
- Uploading large videos over Wi-Fi can feel slower or less reliable than on the host PC.

## Access Modes

HowToob can be exposed from the host machine in two simple development modes at the same time:

- `LAN`: devices on the same Wi-Fi use the host machine's local network IP such as `192.168.x.x`
- `VPN`: devices connected to the same private VPN overlay use the host machine's VPN IP such as `100.x.x.x`

Both modes can stay enabled together because the backend now accepts a comma-separated list of allowed frontend origins.

### LAN (same Wi-Fi)

1. Run `ipconfig` on the host PC.
2. Use the IPv4 address from the active Wi-Fi adapter, for example `192.168.1.50`.
3. Open the frontend from other devices at:

```text
http://<LAN_IP>:5173
```

4. The backend will be reachable at:

```text
http://<LAN_IP>:5000
```

### VPN (remote access)

1. Connect the host machine and the other device to the same private VPN overlay.
2. Find the host machine's VPN IP from the VPN client, for example `100.64.0.5`.
3. Open the frontend from other VPN-connected devices at:

```text
http://<VPN_IP>:5173
```

4. The backend will be reachable at:

```text
http://<VPN_IP>:5000
```

### LAN vs VPN IP

- A `LAN IP` only works for devices on the same local network, usually the same Wi-Fi.
- A `VPN IP` works for devices joined to the same private VPN, even when they are not on the same Wi-Fi.
- The host machine must stay powered on and keep both backend and frontend running in either mode.

### CORS and environment setup

Set the backend allowlist once and include every frontend origin you plan to use:

```env
CORS_ALLOWED_ORIGINS=http://192.168.1.25:5173,http://100.64.0.5:5173,http://localhost:5173
```

Then point the frontend at whichever backend address matches the access mode you want to use:

```env
# LAN
VITE_API_BASE_URL=http://192.168.1.25:5000

# VPN
VITE_API_BASE_URL=http://100.64.0.5:5000
```

### Switching between LAN and VPN

No code changes are required.

1. Leave the backend running on `0.0.0.0:5000`.
2. Update only `VITE_API_BASE_URL` in `frontend/.env.local` or your shell.
3. Restart the Vite dev server if the environment variable changed.

This lets you move between same-Wi-Fi demos and VPN-overlay access by changing env values only.

Supporting project documents and project-plan artifacts live in `docs/`.
