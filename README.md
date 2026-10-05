# DuoCall — Audio Call (Phase 1)

Real-time 1-to-1 audio calling app built with React, Django Channels, and WebRTC.

> **Scope:** This branch covers audio calling only. Video call support is handled separately and will be merged later.

---

## Tech Stack

| Side | Tech |
|------|------|
| Frontend | React 19, TypeScript, Vite |
| Backend | Django 5, Django Channels, Daphne |
| Auth | JWT (SimpleJWT) |
| Real-time | WebSocket (signaling) + WebRTC (audio) |
| DB | SQLite (dev) |

---

## Project Structure

```
WebRtcModel/
├── duocall_backend/    # Django + Channels
│   ├── users/          # Auth, user model, user list API
│   ├── calls/          # Call model, REST API, WebSocket consumer
│   └── duocall_backend/ # Settings, ASGI, JWT middleware
└── duocall_frontend/   # React + TypeScript
    └── src/
        ├── api/        # Axios instance, auth & call API helpers
        ├── context/    # AuthContext, CallContext
        ├── hooks/      # useWebSocket, useAudioCall
        ├── pages/      # Login, Register, Dashboard (user list)
        └── components/ # ProtectedRoute, IncomingCallScreen, ActiveCallScreen
```

---

## Setup

### Backend

```bash
cd duocall_backend
python -m venv venv
.\venv\Scripts\activate        # Windows
pip install -r requirements.txt
python manage.py migrate
```

### Frontend

```bash
cd duocall_frontend
npm install
```

---

## Running

Start both in separate terminals:

```bash
# Terminal 1 — backend (Daphne, not runserver)
cd duocall_backend
.\venv\Scripts\daphne -b 127.0.0.1 -p 8000 duocall_backend.asgi:application

# Terminal 2 — frontend
cd duocall_frontend
npm run dev
```

Open `http://localhost:5173`

---

## How It Works

1. User logs in → JWT token stored in localStorage
2. WebSocket connects to Django Channels (`/ws/signaling/`) using the token
3. Caller clicks **Call** → mic permission → call record created → `call_offer` sent via WebSocket
4. Receiver sees incoming call screen → clicks **Accept** → `call_accepted` sent back
5. SDP offer/answer + ICE candidates exchanged through Django (signaling only)
6. WebRTC connects the two browsers directly — audio flows peer-to-peer
7. Either user can **Mute** or **End** the call

---

## Notes

- `db.sqlite3` is local only, not committed
- `venv/` and `node_modules/` are excluded
- For production: swap SQLite → PostgreSQL, add Redis for Channels, use HTTPS/WSS
