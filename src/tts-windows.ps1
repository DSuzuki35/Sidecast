$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
try {
    Add-Type -AssemblyName System.Speech
    $request = [Console]::In.ReadToEnd() | ConvertFrom-Json
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    if ($request.mode -eq 'voices') {
        $voices = @($synth.GetInstalledVoices() | Where-Object Enabled | ForEach-Object { @{ name=$_.VoiceInfo.Name; language=$_.VoiceInfo.Culture.Name } })
        @{ok=$true;voices=$voices} | ConvertTo-Json -Depth 4 -Compress
    } else {
        if ($request.voice) { $synth.SelectVoice([string]$request.voice) }
        elseif ($request.language -eq 'German') { $synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::NotSet,[System.Speech.Synthesis.VoiceAge]::NotSet,0,[System.Globalization.CultureInfo]::GetCultureInfo('de-DE')) }
        else { $synth.SelectVoiceByHints([System.Speech.Synthesis.VoiceGender]::NotSet,[System.Speech.Synthesis.VoiceAge]::NotSet,0,[System.Globalization.CultureInfo]::GetCultureInfo('en-US')) }
        $synth.SetOutputToWaveFile([string]$request.output)
        $synth.Speak([string]$request.text)
        @{ok=$true} | ConvertTo-Json -Compress
    }
    $synth.Dispose()
} catch { @{ok=$false;error='Windows speech is unavailable. Choose an installed voice.'} | ConvertTo-Json -Compress; exit 1 }
