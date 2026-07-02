# Development Networking

## Overview

Backend runs locally on `localhost:5000`. The mobile app (physical Android device or emulator) cannot reach `localhost` directly, so the backend is exposed via **ngrok**.

```
Android device / emulator
        │
        └── API calls ──── ngrok HTTPS tunnel ──── Backend :5000
                                                        │
                                                    MongoDB :27017
```

Metro (the JS bundler) is handled separately:
- **USB-connected device** — `adb reverse` is set up automatically by `expo run:android`. No extra config needed.
- **Emulator** — Metro is reachable at `10.0.2.2:8081` (Android's alias for host `localhost`). Handled automatically.

---

## Prerequisites

| Tool | Install |
|------|---------|
| Node.js | — |
| MongoDB | running locally |
| ngrok | https://ngrok.com/download — authenticate: `ngrok config add-authtoken <token>` |

---

## Startup (every dev session)

### Terminal 1 — Backend
```powershell
cd backend
npm run dev
```
Wait for: `Server running on port 5000` and `MongoDB connected`.

### Terminal 2 — ngrok tunnel
```powershell
.\scripts\start-ngrok.ps1
```

This script:
1. Kills any existing ngrok process
2. Starts `ngrok http 5000`
3. Polls `localhost:4040/api/tunnels` until the public URL is available
4. **Auto-patches `mobile/.env`** with the live URL
5. Prints next steps

Example output:
```
  ngrok URL  : https://abc123.ngrok-free.app
  API URL    : https://abc123.ngrok-free.app/api/v1
  .env       : mobile/.env updated

  Next steps:
    cd mobile
    npx expo run:android
```

### Terminal 3 — Expo
```powershell
cd mobile
npx expo run:android
```

Connect a physical Android device via USB with USB debugging enabled, or start an Android emulator first.

---

## Changing the backend URL manually

If ngrok is already running and you only need to update the URL:

1. Open `mobile/.env`
2. Update:
   ```
   EXPO_PUBLIC_API_URL=https://your-ngrok-url.ngrok-free.app/api/v1
   ```
3. Restart Metro (press `r` in the Expo terminal, or re-run `npx expo run:android`)

---

## Troubleshooting

### "Unable to reach the server. Check your connection."
The ngrok tunnel is not running or `mobile/.env` has a stale URL.
→ Re-run `.\scripts\start-ngrok.ps1`.

### ngrok "authentication required" error
Your ngrok authtoken is missing or expired.
→ `ngrok config add-authtoken <your-token>` (get token at dashboard.ngrok.com)

### "ERR_NGROK_3200" / tunnel not found
The ngrok session expired (free tier has an 8-hour limit).
→ Re-run `.\scripts\start-ngrok.ps1`.

### Metro fails to connect on USB device
`adb reverse` failed or device is not recognized.
→ Check `adb devices` shows your device, then re-run `npx expo run:android`.

### API URL empty / `[env] API URL: (empty)`
`mobile/.env` was not populated before `npx expo run:android` was started.
→ Run `.\scripts\start-ngrok.ps1` first, then start Expo.

---

## Production

ngrok and local `.env` are **dev-only**.
- Production uses the Railway backend (see `railpack.json` and `backend/.env`).
- Set `EXPO_PUBLIC_API_URL` to the Railway URL in the EAS build environment variables.
- Set `CORS_ORIGIN` in `backend/.env` to the production origin (not `*`).
