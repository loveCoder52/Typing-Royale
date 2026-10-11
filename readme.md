# 🏁 Typing Royale

A real-time multiplayer typing race for you and your friends. Create a room, share the code, and see who types the fastest and most accurately, with live progress bars for every player.

Built by **[Love Sharma](https://lovedev-portfolio-website.vercel.app/)**.

---

## Features

- **Private rooms:** create a room and share its 6-character code. Up to 6 players can join.
- **Host controls:** the host picks the race length (10, 25, 50 or 100 words) and starts the race. At least 2 players are needed.
- **Fair races:** every player gets the same random words.
- **Live stats:** WPM, accuracy and progress update while you type, and freeze when the race ends.
- **Live leaderboard:** watch everyone's progress bar move in real time.
- **Winner screen and rematch:** results are ordered by progress, and the host can send everyone back to the lobby for another round.
- **Anti-cheat basics:** pasting and drag-and-drop are blocked in the typing box.
- **10 themes:** pick a look from the 🎨 Theme button, Monkeytype style. Your choice is saved in the browser.
- **Responsive:** works on desktop and mobile.

## Themes

| Light | Dark |
| --- | --- |
| Sky (default) | Midnight |
| Paper | Serika Dark |
| Mint | Nord |
| Lavender | Dracula |
| Sunset | Terminal |

To add your own theme:

1. In `src/index.css`, copy any `:root[data-theme="..."]` block and give it a new name and colours.
2. In `src/theme-switcher.ts`, add one entry to the `THEMES` array with the same `id` and preview colours.

## Tech stack

- **Frontend:** React, TypeScript, Vite
- **Real-time:** Socket.IO
- **Styling:** plain CSS with CSS variables (no UI library)

## Project structure

```
src/
├── App.tsx             # Game UI: lobby, race, results
├── socket.ts           # Socket.IO client instance
├── theme-switcher.ts   # Theme picker (injected outside React)
├── index.css           # Styles and all themes
└── main.tsx            # App entry point
vite.config.ts          # Dev server and proxy config
```

## Getting started

### Prerequisites

- Node.js 18 or newer
- The Typing Royale Socket.IO backend running on port `3000`

### Run locally

```bash
# install dependencies
npm install

# start the frontend (http://localhost:5173)
npm run dev
```

In development, Vite proxies `/socket.io` to the backend, so no extra setup is needed.

Open the app in two browser tabs (or on two devices on the same network), create a room in one and join it from the other.

### Environment variables

| Variable | Used for | Default |
| --- | --- | --- |
| `BACKEND_URL` | Backend target for the dev and preview proxy (`vite.config.ts`) | `http://127.0.0.1:3000` |
| `VITE_SOCKET_URL` | Backend URL baked into the production build. Leave empty if the backend is served from the same domain. | same origin |

## Production

`npm run build` outputs static files in `dist/`. The proxy in `vite.config.ts` only works in development, so choose one setup:

1. **Same domain:** serve `dist/` with nginx or Caddy and reverse-proxy `/socket.io` to the backend (with WebSocket upgrade enabled). Leave `VITE_SOCKET_URL` empty.
2. **Separate domains:** host the frontend on a static host (Vercel, Netlify) and the backend elsewhere. Build with `VITE_SOCKET_URL=https://your-backend.com` and allow your frontend URL in the backend's Socket.IO CORS settings.

To test the production build locally:

```bash
npm run build
npm run preview   # http://localhost:4173
```

## How the realtime flow works

| Client sends | Purpose |
| --- | --- |
| `room:create` | Create a room with your name |
| `room:join` | Join a room by code |
| `room:set-word-count` | Host changes the word count |
| `race:start` | Host starts the race |
| `race:type` | Send the current typed text |
| `race:rematch` | Host returns everyone to the lobby |

| Server sends | Purpose |
| --- | --- |
| `room:updated` | Full room state: players, status, text, winner |
| `room:error` | A readable error message |

## Author

**Love Sharma**: [Portfolio](https://lovedev-portfolio-website.vercel.app/)

If you enjoy the project, give it a ⭐ and challenge your friends to a race.