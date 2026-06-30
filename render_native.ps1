$ErrorActionPreference = "Stop"

$demoDir = "demo"
$timestampsFile = "$demoDir\timestamps.json"
$inputFile = "demo\raw.mkv"
$outputFile = "prachar_demo_final.mp4"
$ffmpeg = "bin\ffmpeg.exe"

if (-Not (Test-Path $timestampsFile)) {
    Write-Host "Timestamps file not found."
    exit 1
}

$ts = Get-Content -Raw -Path $timestampsFile | ConvertFrom-Json

$dashboard_ready  = [math]::Round($ts.dashboard_ready.relSeconds, 3)
$typing_start     = [math]::Round($ts.typing_start.relSeconds, 3)
$generation_start = [math]::Round($ts.generation_start.relSeconds, 3)
$generation_end   = [math]::Round($ts.generation_end.relSeconds, 3)
$generate_click   = [math]::Round($ts.generate_click.relSeconds, 3)
$omnideck_click   = [math]::Round($ts.omnideck_click.relSeconds, 3)

Write-Host "Timestamps:"
Write-Host "  dashboard_ready  = $dashboard_ready"
Write-Host "  typing_start     = $typing_start"
Write-Host "  generation_start = $generation_start"
Write-Host "  generation_end   = $generation_end"
Write-Host "  generate_click   = $generate_click"
Write-Host "  omnideck_click   = $omnideck_click"

$speedA = 0.667
$speedB = 0.667
$speedC = 1.0
$speedD = 1.176
$speedE = 1.0
$speedF = 1.0

$atempoA = 1.5
$atempoD = 0.85

$videoSegments = "[0:v]trim=start=0:end=${dashboard_ready},setpts=${speedA}*(PTS-STARTPTS)[vA];" +
"[0:v]trim=start=${dashboard_ready}:end=${typing_start},setpts=${speedB}*(PTS-STARTPTS)[vB];" +
"[0:v]trim=start=${typing_start}:end=${generation_start},setpts=${speedC}*(PTS-STARTPTS)[vC];" +
"[0:v]trim=start=${generation_start}:end=${generation_end},setpts=${speedD}*(PTS-STARTPTS)[vD];" +
"[0:v]trim=start=${generation_end}:end=${omnideck_click},setpts=${speedE}*(PTS-STARTPTS)[vE];" +
"[0:v]trim=start=${omnideck_click},setpts=${speedF}*(PTS-STARTPTS)[vF];" +
"[vA][vB][vC][vD][vE][vF]concat=n=6:v=1:a=0[v_ramped]"

$audioSegments = "[0:a]atrim=start=0:end=${dashboard_ready},asetpts=PTS-STARTPTS,atempo=${atempoA}`[aA];" +
"[0:a]atrim=start=${dashboard_ready}:end=${typing_start},asetpts=PTS-STARTPTS,atempo=${atempoA}`[aB];" +
"[0:a]atrim=start=${typing_start}:end=${generation_start},asetpts=PTS-STARTPTS[aC];" +
"[0:a]atrim=start=${generation_start}:end=${generation_end},asetpts=PTS-STARTPTS,atempo=${atempoD}`[aD];" +
"[0:a]atrim=start=${generation_end}:end=${omnideck_click},asetpts=PTS-STARTPTS[aE];" +
"[0:a]atrim=start=${omnideck_click},asetpts=PTS-STARTPTS[aF];" +
"[aA][aB][aC][aD][aE][aF]concat=n=6:v=0:a=1[audio_out]"

# zoompan filter generator
function Get-ZoomFilter {
    param($triggerTs)
    $startFrame = [int]($triggerTs * 25)
    $p3 = $startFrame + 3
    $p8 = $startFrame + 8
    $endFrame = $startFrame + 11
    return "zoompan=z='if(between(on,$startFrame,$p3),zoom+0.05,if(between(on,$p3,$p8),1.15,if(between(on,$p8,$endFrame),zoom-0.05,1)))':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=25"
}

$zoomGen = Get-ZoomFilter $generate_click
$zoomOmni = Get-ZoomFilter $omnideck_click

$videoGrade = "[v_ramped]$zoomGen,$zoomOmni,colorbalance=bs=0.05:bh=-0.03,curves=all='0/0 0.5/0.55 1/1'[v_out]"

$filterComplex = "$videoSegments;$videoGrade"

Write-Host "Running FFmpeg natively on Windows..."
& $ffmpeg -y -i $inputFile -filter_complex $filterComplex -map "[v_out]" -c:v libx264 -crf 16 -preset slow -movflags +faststart -pix_fmt yuv420p -an $outputFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "SUCCESS! Final video saved to $outputFile"
} else {
    Write-Host "FFmpeg Failed."
    exit 1
}
