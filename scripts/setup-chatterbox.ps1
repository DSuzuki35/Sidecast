[CmdletBinding()]
param([switch]$CpuOnly, [switch]$SkipModelDownload)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$runtimeRoot = Join-Path $env:LOCALAPPDATA 'Sidecast\chatterbox'
$projectRoot = Split-Path $PSScriptRoot -Parent
$pythonPath = Join-Path $runtimeRoot 'venv\Scripts\python.exe'
$uvPath = Join-Path $runtimeRoot 'tools\uv.exe'
New-Item -ItemType Directory -Force $runtimeRoot | Out-Null
Start-Transcript -LiteralPath (Join-Path $runtimeRoot 'setup.log') -Force | Out-Null

# This executable is pinned and verified before execution. No global install/PATH edits.
if (-not (Test-Path -LiteralPath $uvPath)) {
    Write-Host 'Downloading the isolated Python installer...'
    $archive = Join-Path $runtimeRoot 'uv.zip'
    Invoke-WebRequest -UseBasicParsing 'https://github.com/astral-sh/uv/releases/download/0.13.9/uv-x86_64-pc-windows-msvc.zip' -OutFile $archive
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne 'edd61f7f5728a56cc62455386661860bdfc7bab65872f39b0c25bdcc1d8e1beb') {
        throw 'The uv installer checksum does not match. Download aborted.'
    }
    Expand-Archive -LiteralPath $archive -DestinationPath (Join-Path $runtimeRoot 'tools') -Force
}
$env:UV_PYTHON_INSTALL_DIR = Join-Path $runtimeRoot 'python'
$env:UV_PYTHON_BIN_DIR = Join-Path $runtimeRoot 'bin'
$env:UV_CACHE_DIR = Join-Path $runtimeRoot 'uv-cache'
$env:HF_HOME = Join-Path $runtimeRoot 'huggingface'
$env:HF_HUB_DISABLE_TELEMETRY = '1'
$env:HF_HUB_DISABLE_SYMLINKS_WARNING = '1'
$env:DO_NOT_TRACK = '1'
$env:PYTHONUTF8 = '1'
if (-not (Test-Path -LiteralPath $pythonPath)) {
    & $uvPath venv --managed-python --python 3.11.15 (Join-Path $runtimeRoot 'venv')
    if ($LASTEXITCODE -ne 0) { throw 'Isolated Python installation failed.' }
}
Write-Host 'Installing speech dependencies (CUDA downloads several GB)...'
$torchIndex = if ($CpuOnly) { 'https://download.pytorch.org/whl/cpu' } else { 'https://download.pytorch.org/whl/cu128' }
& $uvPath pip install --python $pythonPath torch==2.9.1 torchaudio==2.9.1 --index-url $torchIndex
if ($LASTEXITCODE -ne 0) { throw 'PyTorch installation failed.' }
& $uvPath pip install --python $pythonPath -r (Join-Path $projectRoot 'tts\requirements-chatterbox.txt')
if ($LASTEXITCODE -ne 0) { throw 'Chatterbox dependency installation failed.' }
& $uvPath pip install --python $pythonPath --no-deps chatterbox-tts==0.1.6
if ($LASTEXITCODE -ne 0) { throw 'Chatterbox installation failed.' }
if (-not $SkipModelDownload) {
    Write-Host 'Downloading the pinned Chatterbox voice-cloning model...'
    & $pythonPath (Join-Path $projectRoot 'tts\download_chatterbox.py')
    if ($LASTEXITCODE -ne 0) { throw 'Speech model download failed. Rerun setup to resume.' }
}
$statusJson = & $pythonPath (Join-Path $projectRoot 'tts\chatterbox_worker.py') --status
if ($LASTEXITCODE -ne 0) { throw 'Runtime validation failed.' }
$status = $statusJson | ConvertFrom-Json
if ($status.ok) {
    $statusJson | Set-Content -LiteralPath (Join-Path $runtimeRoot 'setup.json') -Encoding UTF8
    Write-Host "Local TTS is ready. Python: $pythonPath"
} elseif ($SkipModelDownload) {
    Write-Host 'Python dependencies installed. Run setup without -SkipModelDownload to finish.'
} else {
    throw 'Runtime dependencies or model files are incomplete.'
}

Stop-Transcript | Out-Null
