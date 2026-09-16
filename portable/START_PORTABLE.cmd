@echo off
setlocal DisableDelayedExpansion
cd /d "%~dp0"
set "NODE_OPTIONS="
if not exist "runtime\node.exe" (
  echo Download and extract the PORTABLE release ZIP. This is not the source-code ZIP.
  pause
  exit /b 1
)
"runtime\node.exe" "portable/start.mjs"
set "ledgerExit=%errorlevel%"
echo.
pause
exit /b %ledgerExit%
