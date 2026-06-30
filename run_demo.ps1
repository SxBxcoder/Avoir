$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================================"
Write-Host "       PRACHAR.AI -- Cinematic Demo Recording Pipeline"
Write-Host "============================================================"
Write-Host ""

$env:PATH += ";C:\Users\KIIT0001\Desktop\Computer coding\Hackathons\AWS AI FOR BHARAT\Avoir\bin"

Write-Host "[1/4] Starting OBS recording..."
node demo/obs/obs_controller.js start
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to start OBS recording."
    exit 1
}

Write-Host "[2/4] Starting Playwright Demo sequence..."
node demo/playwright/demo.js
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Playwright demo failed. Stopping OBS..."
    node demo/obs/obs_controller.js stop
    exit 1
}

Write-Host "[3/4] Stopping OBS recording..."
node demo/obs/obs_controller.js stop
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to stop OBS recording."
    exit 1
}

$rawPath = (node demo/obs/obs_controller.js path).Trim()
Write-Host "Success: Raw recording saved to: $rawPath"

if (-Not (Test-Path $rawPath)) {
    Write-Host "Error: Recording file not found at path: $rawPath"
    exit 1
}

Write-Host "[4/4] Initiating FFmpeg Cinematic Grading Pipeline (Native)..."
Copy-Item -Path $rawPath -Destination "demo\raw.mkv" -Force
.\render_native.ps1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Pipeline Complete! Check prachar_demo_final.mp4"
} else {
    Write-Host "Error: FFmpeg grading failed."
    exit 1
}
