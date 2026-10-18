@echo off
title MILKY DESIGN WEBSITE 2
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js was not found on PATH.
  echo   Install Node.js, then run this launcher again.
  echo.
  pause
  exit /b 1
)

node tools\start.js %*

echo.
echo   Server stopped.
pause
