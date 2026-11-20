@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js 20.19 or newer is required. Download it from https://nodejs.org and run this file again. & pause & exit /b 1)
if not exist node_modules call npm ci
node scripts\launch.mjs %*
pause
