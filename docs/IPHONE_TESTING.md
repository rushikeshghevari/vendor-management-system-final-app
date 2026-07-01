# Testing on a Physical iPhone via Expo Go

This sets up two independent tunnels:

1. **Backend tunnel (ngrok)** — exposes `backend` (port 5000) over a public HTTPS URL, so the API is reachable regardless of what network the iPhone is on.
2. **Expo tunnel** — exposes the Metro bundler (port 8081) over its own public URL, so Expo Go can load the JS bundle regardless of network.

These are two separate tunneling products (`ngrok.exe` for the backend, Expo's bundled `@expo/ngrok` for Metro) running as independent processes — they do not conflict and do not share an account/session.

## Prerequisites (one-time)

- **ngrok CLI** installed and on `PATH`, with a free account authtoken configured:
  ```bash
  ngrok config add-authtoken <your-authtoken>   # from https://dashboard.ngrok.com/get-started/your-authtoken
  ```
- **`@expo/ngrok`** installed in `mobile/` (lets `expo start --tunnel` run without an interactive install prompt):
  ```bash
  cd mobile
  npm install --save-dev @expo/ngrok --legacy-peer-deps
  ```
- **Expo Go** installed on the iPhone from the App Store.
- Windows Firewall allows inbound TCP on port 5000 (only needed if you ever fall back to LAN-IP testing instead of ngrok):
  ```powershell
  # Run in an elevated PowerShell
  New-NetFirewallRule -DisplayName "VMS Backend Dev" -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Allow
  ```

## Exact commands, in order

**1. Start MongoDB**, then seed a user once:
```bash
cd backend
npm run seed     # creates superadmin@vms.local / ChangeMe123! if it doesn't already exist
```

**2. Start the backend** (binds to `0.0.0.0:5000`, i.e. all interfaces):
```bash
cd backend
npm run dev
```
Verify locally before tunneling:
```bash
curl http://localhost:5000/health
```

**3. Start the ngrok tunnel for the backend**, in a separate terminal:
```bash
ngrok http 5000
```
Copy the `https://....ngrok-free.dev` (or `.app`) URL it prints — this changes every time you restart ngrok unless you're on a paid plan with a reserved domain.

Verify the tunnel works before touching the mobile app:
```bash
curl https://<your-ngrok-subdomain>.ngrok-free.dev/health
curl -X POST https://<your-ngrok-subdomain>.ngrok-free.dev/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@vms.local","password":"ChangeMe123!"}'
```
Both must return JSON (not an ngrok error page, not a connection error) before proceeding.

**4. Point the mobile app at the ngrok URL.** Edit `mobile/.env`:
```
EXPO_PUBLIC_API_URL=https://<your-ngrok-subdomain>.ngrok-free.dev/api/v1
```
Note the `/api/v1` suffix — the backend mounts all routes there (`app.use('/api/v1', routes)` in `backend/src/app.ts`). A bare `/api` (no `/v1`) will 404 on every request.

**5. Start Expo in tunnel mode**, in a third terminal:
```bash
cd mobile
npx expo start --tunnel
```
On the **first ever run**, Expo CLI prompts to install `@expo/ngrok` — accept it (or pre-install it per the Prerequisites section to skip the prompt, which is required if you're scripting/automating this start).

Wait for:
```
Tunnel connected.
Tunnel ready.
```
A QR code prints in the terminal.

**6. Open it on the iPhone**:
- Open the iPhone's **Camera** app (not Expo Go's scanner — that's the Android path) and point it at the QR code. iOS recognizes Expo's QR payload and offers to open it in Expo Go.
- Alternatively, in Expo Go, use **Enter URL manually** and type the `exp://...` tunnel URL shown above the QR code in the terminal.

## Why both tunnels are needed

`expo start --tunnel` only tunnels the **Metro bundler** (the JS code). It does not — and cannot — know about or expose your separate Express server on port 5000. Without the ngrok tunnel for the backend, the app bundle would load fine over Expo's tunnel, but every API call (login, etc.) would fail to connect, because `EXPO_PUBLIC_API_URL` would still be pointing at something the phone can't reach (`localhost`, or a LAN IP if the phone isn't on the same WiFi).

## Restarting after a change

- **Changed `mobile/.env`?** `EXPO_PUBLIC_*` vars are inlined into the JS bundle at build time. A Metro fast-refresh is *not* enough — fully stop (`Ctrl+C`) and rerun `npx expo start --tunnel`.
- **ngrok URL changed** (you restarted `ngrok http 5000`)? Update `mobile/.env` and restart Expo per above. The free ngrok plan assigns a new random subdomain on most restarts.
- **Backend restarted but ngrok didn't?** No action needed — ngrok just keeps proxying to `localhost:5000`, which is the same backend.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `expo start --tunnel` fails with "failed to start tunnel / remote gone away" | `@expo/ngrok` isn't installed, and the CLI couldn't prompt to install it (e.g. running non-interactively, or the prompt was missed) | `cd mobile && npm install --save-dev @expo/ngrok --legacy-peer-deps`, then rerun |
| Login works via `curl` through ngrok but fails in the app | `EXPO_PUBLIC_API_URL` missing `/api/v1`, stale (old ngrok URL after a restart), or Expo wasn't restarted after editing `.env` | Check `mobile/.env`, restart `expo start --tunnel` |
| ngrok shows an interstitial/warning page instead of JSON | Hitting the tunnel from a *browser* on the free plan (adds a click-through warning) — not an issue for the app or `curl`, which don't trigger it | Ignore; verify with `curl` instead, or click through once in browser |
| iPhone scans QR but nothing happens / times out | iPhone has no internet route to the tunnel (e.g. captive WiFi portal, VPN blocking), or the camera scan target wasn't recognized | Confirm iPhone has working internet (open any website), retry scan, or use "Enter URL manually" in Expo Go |
| App loads but every screen shows a network/login error | Backend ngrok tunnel died (e.g. you closed that terminal) while the Expo tunnel is still running | Check the ngrok terminal is still alive (`curl https://<subdomain>.ngrok-free.dev/health`); restart `ngrok http 5000` and update `mobile/.env` + restart Expo if the URL changed |
| `ngrok http 5000` fails immediately with an account/session error | Free ngrok plan allows only one **agent session** of the *same kind* at a time; you may have another `ngrok.exe` (not Expo's bundled one) already running | `Get-Process ngrok \| Stop-Process -Force` (PowerShell), then restart |
| Backend unreachable even on the same WiFi via LAN IP (no ngrok) | Windows Firewall blocking inbound port 5000 | Add the firewall rule from Prerequisites |
| `/auth/me` returns 401 right after a successful login | Access token expired (15 min default) before you got to testing it, or device clock is wrong | Log in again; check `JWT_ACCESS_EXPIRES_IN` in `backend/.env` if this happens too fast |

## Stopping everything

```bash
# Backend (Ctrl+C in its terminal), or:
Get-NetTCPConnection -LocalPort 5000 | Select -Expand OwningProcess -Unique | % { Stop-Process -Id $_ -Force }

# Backend ngrok tunnel (Ctrl+C in its terminal), or:
Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force

# Expo (Ctrl+C in its terminal)
```
