@echo off
set "AGENT_RISE_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "AGENT_RISE_NODE=C:\Users\I Mine\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not "%AGENT_RISE_NODE%"=="node" if not exist "%AGENT_RISE_NODE%" (
  echo Node.js is required. Install Node.js from https://nodejs.org and run this again.
  pause
  exit /b 1
)
start "" "http://127.0.0.1:8766/Agent-Rise.html"
"%AGENT_RISE_NODE%" "%~dp0preview.cjs"
pause
