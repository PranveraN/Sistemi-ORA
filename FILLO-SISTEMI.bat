@echo off
title Akademia Ora - Sistemi i Menaxhimit
color 0B
cls

:: Shto Node.js te PATH
set "PATH=C:\Program Files\nodejs\;%PATH%"
set "PATH=%APPDATA%\npm;%PATH%"

echo ==============================================
echo      AKADEMIA ORA - Sistemi i Menaxhimit
echo ==============================================
echo.

:: Verifiko Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [GABIM] Node.js nuk eshte i instaluar!
    echo.
    echo Shkoni te: https://nodejs.org dhe instaloni LTS.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node --version') do echo [OK] Node.js %%v
echo.

:: Instalo paketat nese mungojne
if not exist "node_modules" (
    echo [INFO] Duke instaluar paketat... (1-2 minuta)
    npm install
    echo.
)

:: Krijo DB nese mungon
if not exist "prisma\akademia-ora.db" (
    echo [INFO] Duke krijuar bazen e te dhenave...
    npx prisma db push
    echo.
    echo [INFO] Duke ngarkuar te dhenat fillestare...
    npx tsx prisma/seed.ts
    echo.
)

echo ==============================================
echo   Sistemi po starton...
echo   Hap shfletuesin te: http://localhost:3000
echo.
echo   Admin:  admin@akademiaora.al  /  admin123
echo ==============================================
echo.

npm run dev
