$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $projectRoot "agent\.env"
$envExample = Join-Path $projectRoot "agent\.env.example"

if (-not (Test-Path -LiteralPath $envFile)) {
    Copy-Item -LiteralPath $envExample -Destination $envFile
}

function Set-DotEnvValue {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Value
    )
    $lines = [System.Collections.Generic.List[string]]::new()
    foreach ($line in [System.IO.File]::ReadAllLines($envFile)) {
        $lines.Add($line)
    }
    $updated = $false
    for ($index = 0; $index -lt $lines.Count; $index++) {
        if ($lines[$index] -match ("^" + [regex]::Escape($Name) + "=")) {
            $lines[$index] = "$Name=$Value"
            $updated = $true
            break
        }
    }
    if (-not $updated) {
        $lines.Add("$Name=$Value")
    }
    [System.IO.File]::WriteAllLines($envFile, $lines, [System.Text.UTF8Encoding]::new($false))
}

Write-Host "ARCANA Minds setup" -ForegroundColor Cyan
Write-Host "The key is stored only in agent\.env and will not be printed."
$secureKey = Read-Host "Paste MINDS_API_KEY" -AsSecureString
$pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
try {
    $apiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
}
if ($apiKey -notmatch '^minds_[A-Za-z0-9_-]+$') {
    throw "The API key format is invalid. Minds keys normally begin with minds_."
}

$sparkId = ""
$sparkId = "0582483e-f36b-1410-8466-00039ce7df11"
Write-Host "Using TARO Mind ID: $sparkId" -ForegroundColor Green
if ([string]::IsNullOrWhiteSpace($sparkId)) {
    $sparkId = (Read-Host "Paste the Mind Spark ID").Trim()
}
if ([string]::IsNullOrWhiteSpace($sparkId)) {
    throw "The Mind Spark ID cannot be empty."
}

Set-DotEnvValue -Name "MINDS_API_KEY" -Value $apiKey
Set-DotEnvValue -Name "MINDS_SPARK_ID" -Value $sparkId
Set-DotEnvValue -Name "MINDS_API_BASE" -Value "https://api.build.hellominds.ai"

Write-Host ""
Write-Host "Mind configuration saved. Restart start.bat for it to take effect." -ForegroundColor Green
