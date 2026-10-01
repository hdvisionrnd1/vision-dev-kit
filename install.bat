@echo off
setlocal
title vision-dev installer
echo.
echo  vision-dev installer for Claude Code
echo  -----------------------------------
echo  If Windows asks for permission while installing programs, click Yes.
echo.

if exist "%~dp0install.ps1" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor 3072; & ([scriptblock]::Create((Invoke-RestMethod 'https://raw.githubusercontent.com/hdvisionrnd1/vision-dev-kit/main/install.ps1'))) %*"
)

echo.
echo  Press any key to close this window.
pause >nul
