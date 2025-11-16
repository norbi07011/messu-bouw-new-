@echo off
chcp 65001 >nul
color 0B

echo.
echo ╔══════════════════════════════════════════════╗
echo ║   MESSU BOUW - Invoice Management System    ║
echo ║          Automatyczna instalacja            ║
echo ╚══════════════════════════════════════════════╝
echo.

echo [1/4] Sprawdzam Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Node.js nie jest zainstalowany!
    echo Pobierz z: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✓ Node.js %NODE_VERSION% zainstalowany

echo.
echo [2/4] Sprawdzam npm...
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm nie jest zainstalowany!
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo ✓ npm %NPM_VERSION% zainstalowany

echo.
echo [3/4] Instaluję zależności...
echo To może potrwać kilka minut...
echo.

call npm install

if %errorlevel% neq 0 (
    echo.
    echo ❌ Błąd podczas instalacji zależności!
    pause
    exit /b 1
)

echo.
echo ✓ Wszystkie zależności zainstalowane

echo.
echo [4/4] Instalacja zakończona!
echo.
echo ╔══════════════════════════════════════════════╗
echo ║           APLIKACJA GOTOWA!                  ║
echo ╚══════════════════════════════════════════════╝
echo.
echo Dostępne komendy:
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.
echo 📱 Uruchom aplikację desktop:
echo    npm run electron:dev
echo.
echo 🌐 Uruchom w przeglądarce:
echo    npm run dev
echo.
echo 📦 Zbuduj instalator .exe:
echo    npm run build
echo    npm run electron:build
echo.
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo.

set /p "LAUNCH=Czy chcesz uruchomić aplikację teraz? (T/N): "
if /i "%LAUNCH%"=="T" (
    echo.
    echo Uruchamiam aplikację desktop...
    call npm run electron:dev
) else if /i "%LAUNCH%"=="Y" (
    echo.
    echo Uruchamiam aplikację desktop...
    call npm run electron:dev
) else (
    echo.
    echo Dziękujemy! Uruchom aplikację komendą: npm run electron:dev
    pause
)
