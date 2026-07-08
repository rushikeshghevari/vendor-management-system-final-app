#!/usr/bin/env pwsh
# start-usb.ps1 — Start Expo Metro for USB-connected Android device.
#
# Fixes applied here:
#   1. adb reverse is re-applied every run (rules are lost on USB reconnect)
#   2. REACT_NATIVE_PACKAGER_HOSTNAME=127.0.0.1 forces Metro to bind to IPv4 loopback,
#      not [::1] (Node 18+ resolves "localhost" to IPv6 by default — adb reverse is IPv4)
#   3. --dev-client required to connect to the installed development build
#   4. NO --clear: clearing cache forces a 21s+ cold-start that OkHttp times out on.
#      Use --clear only once if you hit a genuine stale-cache crash.
#
# Usage (from repo root):
#   .\scripts\start-usb.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$METRO_PORT   = 8081
$BACKEND_PORT = 5000
$MOBILE_DIR   = Join-Path $PSScriptRoot "..\mobile"

Write-Host ""
Write-Host "=== USB Dev Start ===" -ForegroundColor Cyan

# ── 1. Check device ──────────────────────────────────────────────────────────
Write-Host "`n[1/3] Checking ADB device..." -ForegroundColor Yellow
$devices = adb devices 2>&1 | Select-String "device$"
if (-not $devices) {
    Write-Host "ERROR: No Android device found. Connect via USB and enable USB Debugging." -ForegroundColor Red
    exit 1
}
Write-Host "  Device found: $($devices -join ', ')" -ForegroundColor Green

# ── 2. adb reverse ───────────────────────────────────────────────────────────
Write-Host "`n[2/3] Setting adb reverse rules..." -ForegroundColor Yellow
adb reverse tcp:$METRO_PORT  tcp:$METRO_PORT  | Out-Null
adb reverse tcp:$BACKEND_PORT tcp:$BACKEND_PORT | Out-Null
$rules = adb reverse --list
Write-Host "  Active rules:" -ForegroundColor Green
$rules | ForEach-Object { Write-Host "    $_" }

# ── 3. Start Metro on IPv4 loopback ─────────────────────────────────────────
Write-Host "`n[3/3] Starting Metro (IPv4 127.0.0.1, no --clear)..." -ForegroundColor Yellow
Write-Host "  Metro will bind to 127.0.0.1:8081 (IPv4) so adb reverse can reach it." -ForegroundColor Gray
Write-Host "  Do NOT use --clear - it forces a 21s+ cold build that times out OkHttp." -ForegroundColor Gray
Write-Host ""

Set-Location $MOBILE_DIR
$env:REACT_NATIVE_PACKAGER_HOSTNAME = "127.0.0.1"
npx expo start --dev-client
