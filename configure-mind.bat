@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0configure-mind.ps1"
if errorlevel 1 (
  echo.
  echo Mind configuration failed. Review the message above.
  pause
)
