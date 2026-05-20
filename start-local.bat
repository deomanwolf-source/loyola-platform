@echo off
cd /d "%~dp0"
start "Loyola Backend" powershell -NoExit -ExecutionPolicy Bypass -Command "cd '%~dp0backend'; npm run dev"
start "Loyola Frontend" powershell -NoExit -ExecutionPolicy Bypass -Command "cd '%~dp0'; npm run dev:frontend"
echo Started Loyola backend and frontend.
echo Make sure XAMPP Apache and MySQL are running.
pause
