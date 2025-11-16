# ===============================================
# MESSU BOUW - Automatyczna instalacja
# ===============================================

Write-Host "
╔══════════════════════════════════════════════╗
║   MESSU BOUW - Invoice Management System    ║
║          Automatyczna instalacja            ║
╚══════════════════════════════════════════════╝
" -ForegroundColor Cyan

# Sprawdź Node.js
Write-Host "`n[1/4] Sprawdzam Node.js..." -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js nie jest zainstalowany!" -ForegroundColor Red
    Write-Host "Pobierz z: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "Naciśnij Enter aby zakończyć"
    exit 1
}

$nodeVersion = node --version
Write-Host "✓ Node.js $nodeVersion zainstalowany" -ForegroundColor Green

# Sprawdź npm
Write-Host "`n[2/4] Sprawdzam npm..." -ForegroundColor Yellow
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ npm nie jest zainstalowany!" -ForegroundColor Red
    exit 1
}

$npmVersion = npm --version
Write-Host "✓ npm $npmVersion zainstalowany" -ForegroundColor Green

# Instaluj zależności
Write-Host "`n[3/4] Instaluję zależności..." -ForegroundColor Yellow
Write-Host "To może potrwać kilka minut..." -ForegroundColor Gray

npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Błąd podczas instalacji zależności!" -ForegroundColor Red
    Read-Host "Naciśnij Enter aby zakończyć"
    exit 1
}

Write-Host "✓ Wszystkie zależności zainstalowane" -ForegroundColor Green

# Zakończenie
Write-Host "`n[4/4] Instalacja zakończona!" -ForegroundColor Green

Write-Host "
╔══════════════════════════════════════════════╗
║           APLIKACJA GOTOWA!                  ║
╚══════════════════════════════════════════════╝

Dostępne komendy:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📱 Uruchom aplikację desktop:
   npm run electron:dev

🌐 Uruchom w przeglądarce:
   npm run dev

📦 Zbuduj instalator .exe:
   npm run build
   npm run electron:build

📱 Zbuduj APK (Android):
   npm run build
   npx cap sync android
   npx cap open android

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
" -ForegroundColor Cyan

Write-Host "`nCzy chcesz uruchomić aplikację teraz? (T/N): " -ForegroundColor Yellow -NoNewline
$response = Read-Host

if ($response -eq "T" -or $response -eq "t" -or $response -eq "Y" -or $response -eq "y") {
    Write-Host "`nUruchamiam aplikację desktop..." -ForegroundColor Green
    npm run electron:dev
} else {
    Write-Host "`nDziękujemy! Uruchom aplikację komendą: npm run electron:dev" -ForegroundColor Cyan
}
