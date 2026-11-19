@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo יש להתקין Node.js 20.19 ומעלה מהכתובת https://nodejs.org & pause & exit /b 1)
if not exist node_modules call npm ci
node scripts\launch.mjs %*
pause
