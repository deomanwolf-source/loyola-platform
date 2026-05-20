Write-Host "Stopping local Node/Vite apps..." -ForegroundColor Cyan
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Write-Host "Done. XAMPP Apache/MySQL are not stopped." -ForegroundColor Green
