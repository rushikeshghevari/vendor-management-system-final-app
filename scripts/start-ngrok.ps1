# start-ngrok.ps1
# Starts an ngrok HTTPS tunnel for the local backend (port 5000) and
# auto-patches mobile/.env with the live public URL.
#
# Usage (from repo root):
#   .\scripts\start-ngrok.ps1
#
# Prerequisite: ngrok installed and authenticated.
#   Install : https://ngrok.com/download  OR  npm install -g ngrok
#   Auth    : ngrok config add-authtoken <your-token>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path $PSScriptRoot -Parent
$envFile  = Join-Path $repoRoot 'mobile\.env'

# --- resolve actual ngrok binary (handles npm shim wrappers) -----------------
#
# On Windows, "npm install -g ngrok" puts a ngrok.ps1 shim on PATH.
# Start-Process cannot launch a .ps1 file directly as a process, so we must
# resolve the real .exe from the shim's sibling node_modules directory.

function Get-NgrokExe {
    $cmd = Get-Command ngrok -ErrorAction SilentlyContinue
    if (-not $cmd) { return $null }

    $src = $cmd.Source

    # If the shim is a script wrapper, find the real binary next to it.
    if ($src -match '\.(ps1|cmd)$') {
        $shimDir = Split-Path $src
        $candidates = @(
            (Join-Path $shimDir 'node_modules\ngrok\bin\ngrok.exe'),
            "$env:LOCALAPPDATA\ngrok\ngrok.exe",
            "$env:ProgramFiles\ngrok\ngrok.exe",
            "$env:ProgramFiles(x86)\ngrok\ngrok.exe"
        )
        foreach ($c in $candidates) {
            if (Test-Path $c) { return $c }
        }
        return $null
    }

    # Already a real executable
    return $src
}

# --- sanity checks -----------------------------------------------------------

$ngrokExe = Get-NgrokExe
if (-not $ngrokExe) {
    Write-Host ''
    Write-Host '  ERROR: ngrok executable not found.' -ForegroundColor Red
    Write-Host '  Install via:  npm install -g ngrok' -ForegroundColor Yellow
    Write-Host '           or:  https://ngrok.com/download' -ForegroundColor Yellow
    Write-Host '  Then auth:    ngrok config add-authtoken <your-token>' -ForegroundColor Yellow
    Write-Host ''
    exit 1
}

if (-not (Test-Path $envFile)) {
    Write-Host "  ERROR: mobile/.env not found at $envFile" -ForegroundColor Red
    exit 1
}

# --- kill any existing ngrok -------------------------------------------------

$existing = Get-Process -Name ngrok -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host '  Stopping existing ngrok process...' -ForegroundColor DarkGray
    $existing | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep 1
}

# --- start ngrok -------------------------------------------------------------

Write-Host ''
Write-Host '  Starting ngrok tunnel  :5000 -> HTTPS' -ForegroundColor Cyan
Write-Host "  Binary: $ngrokExe" -ForegroundColor DarkGray

$proc = Start-Process -FilePath $ngrokExe `
    -ArgumentList 'http', '5000' `
    -WindowStyle Hidden -PassThru

# --- wait for URL ------------------------------------------------------------
# Use 127.0.0.1 explicitly — on Windows, "localhost" often resolves to ::1
# (IPv6) first, but ngrok only binds its web API on 127.0.0.1 (IPv4).

Write-Host '  Waiting for public URL' -NoNewline -ForegroundColor DarkGray
$ngrokUrl = $null

for ($i = 0; $i -lt 30; $i++) {
    Start-Sleep 1
    Write-Host '.' -NoNewline -ForegroundColor DarkGray
    try {
        $resp   = Invoke-RestMethod 'http://127.0.0.1:4040/api/tunnels' -ErrorAction SilentlyContinue
        $tunnel = $resp.tunnels | Where-Object { $_.proto -eq 'https' } | Select-Object -First 1
        if ($tunnel) {
            $ngrokUrl = $tunnel.public_url.TrimEnd('/')
            break
        }
    } catch {
        # ngrok not ready yet - keep polling
    }
}
Write-Host ''

if (-not $ngrokUrl) {
    Write-Host ''
    Write-Host '  ERROR: Could not detect ngrok URL after 30 s.' -ForegroundColor Red
    Write-Host '  Make sure ngrok is authenticated:' -ForegroundColor Yellow
    Write-Host '    ngrok config add-authtoken <your-token>' -ForegroundColor Yellow
    Write-Host '  Get your token at: https://dashboard.ngrok.com/get-started/your-authtoken' -ForegroundColor Yellow
    $proc | Stop-Process -Force -ErrorAction SilentlyContinue
    exit 1
}

# --- patch mobile/.env -------------------------------------------------------

$apiUrl = "$ngrokUrl/api/v1"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$raw       = [System.IO.File]::ReadAllText($envFile, $utf8NoBom)
$raw       = [System.Text.RegularExpressions.Regex]::Replace(
                 $raw,
                 'EXPO_PUBLIC_API_URL=.*',
                 "EXPO_PUBLIC_API_URL=$apiUrl"
             )
[System.IO.File]::WriteAllText($envFile, $raw, $utf8NoBom)

# --- print summary -----------------------------------------------------------

Write-Host ''
Write-Host "  ngrok URL  : $ngrokUrl"    -ForegroundColor Green
Write-Host "  API URL    : $apiUrl"      -ForegroundColor Green
Write-Host "  .env       : mobile/.env updated" -ForegroundColor Green
Write-Host ''
Write-Host '  Next - open a NEW terminal and run:' -ForegroundColor Cyan
Write-Host '    cd mobile' -ForegroundColor White
Write-Host '    npx expo run:android' -ForegroundColor White
Write-Host ''
Write-Host '  ngrok dashboard: http://127.0.0.1:4040' -ForegroundColor DarkGray
Write-Host '  Press Ctrl+C to stop ngrok.' -ForegroundColor DarkGray
Write-Host ''

# --- keep running until Ctrl+C -----------------------------------------------

Write-Host '  Tunnel is active. Press Ctrl+C to stop.' -ForegroundColor DarkGray
Write-Host ''

try {
    while ($true) {
        Start-Sleep 5
        try {
            $check = Invoke-RestMethod 'http://127.0.0.1:4040/api/tunnels' -ErrorAction Stop
            $alive = $check.tunnels | Where-Object { $_.proto -eq 'https' }
            if (-not $alive) {
                Write-Host '  Tunnel dropped. Re-run this script.' -ForegroundColor Yellow
                break
            }
        } catch {
            Write-Host '  ngrok agent unreachable. Re-run this script.' -ForegroundColor Yellow
            break
        }
    }
} finally {
    Get-Process -Name ngrok -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host '  ngrok stopped.' -ForegroundColor DarkGray
}
