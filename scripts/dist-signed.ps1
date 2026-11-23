param([string]$CertificateThumbprint = $env:SIDECAST_SIGNING_THUMBPRINT)
$ErrorActionPreference = 'Stop'
# npm may inherit PowerShell 7's module path; use Windows PowerShell's provider.
$windowsModules = Join-Path $env:WINDIR 'System32/WindowsPowerShell/v1.0/Modules'
$env:PSModulePath = $windowsModules + ';' + $env:PSModulePath
Import-Module (Join-Path $windowsModules 'Microsoft.PowerShell.Security/Microsoft.PowerShell.Security.psd1')
Set-Location (Split-Path -Parent $PSScriptRoot)
if (-not $CertificateThumbprint) {
    # Windows PowerShell's certificate provider exposes SimplySign EKUs reliably.
    $certificates = @(Get-ChildItem -Path Cert:\CurrentUser\My | Where-Object { $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date) -and (($_.Extensions | Where-Object { $_.Oid.Value -eq '2.5.29.37' }).EnhancedKeyUsages.Value -contains '1.3.6.1.5.5.7.3.3') })
    if ($certificates.Count -ne 1) { throw 'Select a certificate with -CertificateThumbprint or SIDECAST_SIGNING_THUMBPRINT.' }
    $CertificateThumbprint = $certificates[0].Thumbprint
}
if ($CertificateThumbprint -notmatch '^[A-Fa-f0-9]{40}$') { throw 'Invalid certificate thumbprint.' }
$manifest = Get-Content package.json -Raw | ConvertFrom-Json
$config = $manifest.build
$config | Add-Member -NotePropertyName forceCodeSigning -NotePropertyValue $true -Force
$config.win | Add-Member -NotePropertyName signtoolOptions -NotePropertyValue @{
    certificateSha1 = $CertificateThumbprint
    signingHashAlgorithms = @('sha256')
    rfc3161TimeStampServer = 'http://time.certum.pl'
} -Force
$configFile = Join-Path (Get-Location) 'build/signing.generated.json'
try {
    $config | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $configFile -Encoding utf8
    & node node_modules/electron-builder/out/cli/cli.js --win portable --config $configFile
    if ($LASTEXITCODE -ne 0) { throw 'Signed build failed. Connect SimplySign Desktop and try again.' }
    $files = @('release/win-unpacked/Sidecast.exe', "release/Sidecast-$($manifest.version)-portable.exe")
    foreach ($file in $files) {
        $signature = Get-AuthenticodeSignature -LiteralPath $file
        if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Thumbprint -ne $CertificateThumbprint -or -not $signature.TimeStamperCertificate) {
            throw "Signature verification failed for ${file}: $($signature.Status)"
        }
        Write-Host "Verified signed and timestamped: $file"
    }
} finally {
    if (Test-Path -LiteralPath $configFile) { Remove-Item -LiteralPath $configFile }
}
