# Battleship WS Server

TypeScript WebSocket server with a built‑in static HTTP server for the `front/` bundle.

## Requirements
- Node.js 24.x

## Installation
```bash
npm install
```

## Environment
Create `.env` (or copy `env.example`):
```
PORT=3000        # WebSocket port
HTTP_PORT=8181   # Static HTTP port for /front
```

## Run
```bash
npm run start
```

You should see:
- HTTP server listening on http://localhost:8181
- WebSocket listening on ws://localhost:3000

Open the app:
- Frontend: http://localhost:8181
- The frontend connects to WS at ws://localhost:3000

## Messages (short)
All messages are JSON strings with `id: 0`.

- Player
  - `reg` → personal `reg`, broadcast `update_winners`
- Rooms
  - `create_room` → broadcast `update_room`
  - `add_user_to_room` → to both `create_game`, then broadcast `update_room`
  - `single_play` → personal `create_game` vs bot
- Ships
  - `add_ships` → after both submit: personal `start_game`, then broadcast `turn`
- Combat
  - `attack` → broadcast `attack`, broadcast `turn`, on win → `finish` + `update_winners`
  - `randomAttack` → same as `attack`, server picks cell

Notes:
- Incoming `data` may be JSON string; server accepts and parses it.
- Outgoing messages contain `data` serialized as a JSON string (frontend should `JSON.parse(data)`).

## Scripts
- `npm run start` – run server (WS + static HTTP)
- `npm run build` – compile TypeScript
- `npm run lint` – ESLint
- `npm run format` – Prettier

## Shutdown
Ctrl+C – server closes all WS connections and exits gracefully.
