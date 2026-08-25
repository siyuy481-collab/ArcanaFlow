[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot
$agentDirectory = Join-Path $projectRoot "agent"
$frontendDirectory = Join-Path $projectRoot "frontend"
$venvPython = Join-Path $agentDirectory ".venv\Scripts\python.exe"
$venvPythonw = Join-Path $agentDirectory ".venv\Scripts\pythonw.exe"
$desktopPetScript = Join-Path $projectRoot "desktop_pet\arcana_desktop_pet.py"
$nodeModules = Join-Path $frontendDirectory "node_modules"
$logDirectory = Join-Path $projectRoot ".runlogs"
$backendProcess = $null
$frontendProcess = $null

function Resolve-CommandPath {
    param([string[]]$Names)

    foreach ($name in $Names) {
        $command = Get-Command $name -ErrorAction SilentlyContinue
        if ($command) { return $command.Source }
    }
    return $null
}

function Test-PortInUse {
    param([int]$Port)
    return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Test-ArcanaBackend {
    try {
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:8010/" -TimeoutSec 3
        return $response.message -eq "ARCANA API is ready"
    } catch {
        return $false
    }
}

function Test-ArcanaFrontend {
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:5174/" -UseBasicParsing -TimeoutSec 3
        return $response.StatusCode -eq 200 -and $response.Content -match "<title>ARCANA"
    } catch {
        return $false
    }
}

function Wait-ForUrl {
    param([string]$Url, [int]$TimeoutSeconds = 25)

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) { return $true }
        } catch {
            Start-Sleep -Milliseconds 350
        }
    }
    return $false
}

function Stop-ProcessTree {
    param([int]$RootProcessId)

    $children = Get-CimInstance Win32_Process -Filter "ParentProcessId = $RootProcessId" -ErrorAction SilentlyContinue
    foreach ($child in $children) {
        Stop-ProcessTree -RootProcessId $child.ProcessId
    }
    Stop-Process -Id $RootProcessId -Force -ErrorAction SilentlyContinue
}

function Start-ArcanaDesktopPet {
    if ((Test-Path -LiteralPath $venvPythonw) -and (Test-Path -LiteralPath $desktopPetScript)) {
        # The desktop pet owns a Windows mutex, so repeated launches are safe.
        Start-Process -FilePath $venvPythonw -ArgumentList @($desktopPetScript) -WorkingDirectory $projectRoot -WindowStyle Hidden
    }
}

if (-not (Test-Path -LiteralPath $venvPython) -or -not (Test-Path -LiteralPath $nodeModules)) {
    throw "Dependencies are missing. Double-click setup.bat first."
}

$backendPortInUse = Test-PortInUse 8010
$frontendPortInUse = Test-PortInUse 5174
$backendHealthy = $backendPortInUse -and (Test-ArcanaBackend)
$frontendHealthy = $frontendPortInUse -and (Test-ArcanaFrontend)

# Reuse each healthy ARCANA service independently. This also repairs the
# common partial-start case where the API is running but the website is not.
if ($backendHealthy -and $frontendHealthy) {
    Write-Host ""
    Write-Host "ARCANA is already running." -ForegroundColor Green
    Start-ArcanaDesktopPet
    Write-Host "Opening http://127.0.0.1:5174/"
    Start-Process "http://127.0.0.1:5174/"
    return
}

if ($backendPortInUse -and -not $backendHealthy) {
    throw "Port 8010 is used by a program that is not the ARCANA API. Close that program, then run start.ps1 again."
}
if ($frontendPortInUse -and -not $frontendHealthy) {
    throw "Port 5174 is used by a program that is not the ARCANA website. Close that program, then run start.ps1 again."
}

$npm = Resolve-CommandPath @("npm.cmd", "npm")
if (-not $npm) { throw "npm was not found. Check the Node.js installation." }

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

try {
    if ($backendHealthy) {
        Write-Host "Reusing the existing ARCANA backend on port 8010." -ForegroundColor DarkGray
    } else {
        Write-Host "Starting backend..." -ForegroundColor Cyan
        $backendProcess = Start-Process -FilePath $venvPython `
            -ArgumentList @("-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8010") `
            -WorkingDirectory $agentDirectory -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput (Join-Path $logDirectory "backend-output.log") `
            -RedirectStandardError (Join-Path $logDirectory "backend-error.log")
    }

    if ($frontendHealthy) {
        Write-Host "Reusing the existing ARCANA frontend on port 5174." -ForegroundColor DarkGray
    } else {
        Write-Host "Starting frontend..." -ForegroundColor Cyan
        $frontendProcess = Start-Process -FilePath $npm `
            -ArgumentList @("run", "dev", "--", "--host", "127.0.0.1", "--port", "5174") `
            -WorkingDirectory $frontendDirectory -WindowStyle Hidden -PassThru `
            -RedirectStandardOutput (Join-Path $logDirectory "frontend-output.log") `
            -RedirectStandardError (Join-Path $logDirectory "frontend-error.log")
    }

    $backendReady = $backendHealthy -or (Wait-ForUrl "http://127.0.0.1:8010/")
    $frontendReady = $frontendHealthy -or (Wait-ForUrl "http://127.0.0.1:5174/")
    if (-not $backendReady -or -not $frontendReady) {
        throw "Services did not start in time. Check the .runlogs directory."
    }

    Write-Host ""
    Write-Host "ARCANA is running:" -ForegroundColor Green
    Write-Host "  Site: http://127.0.0.1:5174/"
    Write-Host "  API : http://127.0.0.1:8010/"
    Write-Host "  Desktop pet: running (right-click it for lock / topmost settings)"
    Write-Host ""
    Start-ArcanaDesktopPet
    Start-Process "http://127.0.0.1:5174/"
    Write-Host "Keep this window open. Press Ctrl+C to stop the site services."

    while ($true) {
        Start-Sleep -Seconds 1
        if ($backendProcess) {
            $backendProcess.Refresh()
            if ($backendProcess.HasExited) { throw "The backend exited unexpectedly. Check the .runlogs directory." }
        }
        if ($frontendProcess) {
            $frontendProcess.Refresh()
            if ($frontendProcess.HasExited) { throw "The frontend exited unexpectedly. Check the .runlogs directory." }
        }
    }
} finally {
    Write-Host "Stopping services..." -ForegroundColor Yellow
    if ($frontendProcess -and -not $frontendProcess.HasExited) { Stop-ProcessTree -RootProcessId $frontendProcess.Id }
    if ($backendProcess -and -not $backendProcess.HasExited) { Stop-ProcessTree -RootProcessId $backendProcess.Id }
}
