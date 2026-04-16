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

Supporting project documents and project-plan artifacts live in `docs/`.
