$ErrorActionPreference = "Stop"
Write-Host "🎬  Initiating FFmpeg Cinematic Grading Pipeline..."
bash demo/ffmpeg/grade.sh demo/raw.mkv

if ($LASTEXITCODE -eq 0) {
    Write-Host "🎉  Pipeline Complete! Check prachar_demo_final.mp4"
} else {
    Write-Host "❌  FFmpeg grading failed."
    exit 1
}
