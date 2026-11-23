[CmdletBinding()]
param([switch]$Generate, [ValidateSet('cuda','cpu')][string]$Device = 'cuda')
$ErrorActionPreference = 'Stop'
$runtimeRoot = Join-Path $env:LOCALAPPDATA 'Sidecast\tts'
$pythonPath = Join-Path $runtimeRoot 'venv\Scripts\python.exe'
$projectRoot = Split-Path $PSScriptRoot -Parent
if (-not (Test-Path -LiteralPath $pythonPath)) { throw 'Run scripts/setup-tts.ps1 first.' }
& $pythonPath -m unittest discover -s (Join-Path $projectRoot 'tts') -p test_worker.py
if ($LASTEXITCODE -ne 0) { throw 'Worker protocol tests failed.' }
$statusJson = & $pythonPath (Join-Path $projectRoot 'tts\worker.py') --status
if ($LASTEXITCODE -ne 0) { throw 'Worker status failed.' }
Write-Output $statusJson
if (-not ($statusJson | ConvertFrom-Json).ok) { throw 'Runtime or model is not ready. Run setup first.' }
if ($Generate) {
    # A synthetic SAPI voice tests inference without using anyone's recording.
    Add-Type -AssemblyName System.Speech
    $audioRoot = Join-Path $runtimeRoot 'smoke-audio'
    New-Item -ItemType Directory -Force $audioRoot | Out-Null
    $reference = Join-Path $audioRoot 'synthetic-reference.wav'
    $transcript = 'Hello and welcome to the stream. This is a synthetic voice used to test local speech generation.'
    $speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
    try {
        $speaker.SetOutputToWaveFile($reference)
        $speaker.Speak($transcript)
    } finally { $speaker.Dispose() }
    $requests = @(
        @{ id='english'; text='Thanks for following. Welcome to the stream!'; language='English'; reference=$reference; referenceText=$transcript; output=(Join-Path $audioRoot 'english.wav'); device=$Device },
        @{ id='german'; text='Danke fuer deinen Follow. Willkommen im Stream!'; language='German'; reference=$reference; referenceText=$transcript; output=(Join-Path $audioRoot 'german.wav'); device=$Device },
        @{ id='no-transcript'; text='Welcome back!'; language='English'; reference=$reference; referenceText=''; output=(Join-Path $audioRoot 'no-transcript.wav'); device=$Device }
    )
    $clock = [Diagnostics.Stopwatch]::StartNew()
    $responses = $requests | ForEach-Object { $_ | ConvertTo-Json -Compress } | & $pythonPath -u (Join-Path $projectRoot 'tts\worker.py') --root $audioRoot
    if ($LASTEXITCODE -ne 0) { throw 'Speech worker exited unexpectedly.' }
    if (@($responses).Count -ne $requests.Count) { throw 'Worker returned an unexpected number of responses.' }
    foreach ($line in $responses) {
        $result = $line | ConvertFrom-Json
        if (-not $result.ok) { throw $result.error }
        if (-not (Test-Path -LiteralPath $result.path) -or $result.duration -le 0) { throw 'Generated WAV missing or empty.' }
        Write-Output $line
    }
    Write-Host "Inference smoke test passed in $([Math]::Round($clock.Elapsed.TotalSeconds, 1)) seconds. Worker exited; GPU memory released."
}
