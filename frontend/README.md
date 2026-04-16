# HowToob - Frontend

React frontend for HowToob, a subscription-based instructional video learning platform.
Built for OOP Team B as part of the course project.

---

## Tech Stack

| Tool | Purpose |
|---|---|
| React 18 | UI library, all components are functional with hooks |
| React Router v6 | Client-side routing and navigation |
| Vite | Dev server and build tool |
| CSS Modules | Scoped per-component styling, no external CSS framework |
| Fetch API | All HTTP requests to the Flask backend |

---

## Requirements

- Node.js 18 or higher
- The Flask backend running on the host machine at `http://localhost:5000` or `http://<LAN_IP>:5000`

---

## Getting Started

**1. Navigate into the frontend folder**

```bash
cd frontend
```

**2. Install dependencies**

```bash
npm install
```

**3. Start the dev server**

```bash
npm run dev
```

The dev server now binds to the local network, so the site will be available at:

- `http://localhost:5173`
- `http://<LAN_IP>:5173`

To point the frontend directly at a LAN backend, create `frontend/.env.local`:

```env
VITE_API_BASE_URL=http://<LAN_IP>:5000
```

The Flask backend must be running separately on port 5000 for API calls to work.
To start the backend, open a separate terminal from the project root and run:

```powershell
$env:HOST="0.0.0.0"
$env:PORT="5000"
$env:DEBUG="true"
venv\Scripts\python.exe run.py
```

---

## How the Frontend Talks to the Backend

The frontend supports two development modes:

- direct backend calls through `VITE_API_BASE_URL=http://<LAN_IP>:5000`
- Vite proxy fallback when `VITE_API_BASE_URL` is unset

When the env var is unset, Vite proxies API requests to Flask during development.
When React makes a request to `/auth/login`, Vite forwards it to `http://localhost:5000/auth/login`.
When the env var is set, the browser calls the backend directly and Flask CORS must allow the frontend origin.

Proxied routes:

- `/auth` - authentication (login, register, logout, session check)
- `/videos` - video feed, upload, edit, delete
- `/social` - comments, likes, subscriptions
- `/users` - user profile data
- `/admin` - moderation/admin actions

All API calls live in one place: `src/utils/api.js`

---

## Folder Structure

```
frontend/
src/
  components/
    common/         Reusable UI pieces (Navbar, Sidebar, Button, Modal, etc.)
    layout/         MainLayout wrapper that wraps Navbar + Sidebar around pages
  context/
    AuthContext.jsx     Global auth state - who is logged in, login/logout functions
    ProgressContext.jsx Global learning progress state - watch time, quiz scores
  pages/            One file per route/screen
  utils/
    api.js          All fetch calls to the Flask backend (only file that hits the network)
    constants.js    Shared constants like categories, tier names, quiz pass score
    formatters.js   Date, time, number, and string formatting helpers
    validators.js   Form validation functions
  styles/
    variables.css   Design system - all colors, spacing, fonts, and shadows as CSS variables
    global.css      Global reset and base styles
  App.jsx           Root component, defines all routes
```

---

## Pages and Routes

| Route | Page | Access |
|---|---|---|
| `/` | Home | Public |
| `/login` | Login | Public |
| `/register` | Register | Public |
| `/watch/:videoId` | Watch | Public |
| `/search` | Search | Public |
| `/profile/:username` | Profile | Public |
| `/playlist/:playlistId` | Playlist | Public |
| `/dashboard` | User Dashboard | Logged in |
| `/my-playlists` | My Playlists | Logged in |
| `/settings` | Settings | Logged in |
| `/subscription` | Subscription Plans | Logged in |
| `/quiz/:videoId` | Quiz | Logged in |
| `/upload` | Upload Video | Creator only |
| `/creator-dashboard` | Creator Studio | Creator only |

Routes marked "Logged in" or "Creator only" redirect to `/login` if the user is not authenticated.

---

## Authentication

Authentication uses Flask-Login session cookies, not JWT tokens.

- On app load, the frontend calls `GET /auth/me` to check if a session already exists
- If logged in, the user object is stored in `AuthContext` and available anywhere via `useAuth()`
- All fetch calls include `credentials: 'include'` so cookies are sent automatically
- Logging out calls `POST /auth/logout` and clears the context

User roles:

- `viewer` - can watch videos, track progress, take quizzes
- `creator` - everything a viewer can do, plus upload videos and access Creator Studio

---

## Design System

All design values (colors, spacing, fonts, shadows, border radius) are defined as CSS variables in `src/styles/variables.css`.

Key colors:

- Primary red: `#BA190B` - used for buttons, active states, and accents only
- Main background: `#13090A` - dark red-tinted black
- Card/panel background: `#1C1112`
- Light text: `#F8F9FA`
- Muted text: `#A0A0A0`

To change any color across the entire app, update it once in `variables.css`.

---

## What Is Complete (Phase 1)

- Project structure and folder layout
- Full design system with CSS variables
- Navbar with search, user menu, and upload button
- Collapsible sidebar with navigation and category browser
- Login page with form validation and error handling
- Register page with role selection (viewer or creator)
- Auth context with session persistence across page loads
- Protected routes that redirect unauthenticated users
- Home page with video grid and category filter bar
- Routing for all planned pages

---

## What Is Placeholder (Phases 2-6)

These pages exist as stubs and will be built out in later phases:

- Watch page (video player, comments, progress tracking)
- Dashboard (learning stats, quiz scores, history)
- Upload page (video upload form)
- Creator Studio (analytics, video management)
- Quiz page (UI is built, uses mock data until AI service is decided)
- Subscription page (pricing table UI is built, no payment backend yet)
- Profile, Playlist, My Playlists, Settings

---

## Key Decisions and Notes

**Why Vite instead of Create React App?**
CRA is deprecated. Vite is faster and the current standard for React projects.

**Why no CSS framework?**
The design requires a unique HowToob identity. A framework like Bootstrap or Tailwind would make it look generic. CSS Modules give full control with zero style conflicts between components.

**Why session cookies instead of localStorage for auth?**
Flask-Login uses server-side sessions. Storing tokens in localStorage is a known XSS risk. HttpOnly cookies are the safer choice.

**Quiz generation service**
The quiz UI is fully built but uses mock questions. The team still needs to decide on a generation service (OpenAI, Anthropic, or custom). See the TODO comment in `src/pages/Quiz.jsx`.

**Payment processing**
The subscription pricing page is built as a UI only. Payment backend integration is a future decision. See the TODO comment in `src/pages/Subscription.jsx`.
