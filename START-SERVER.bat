@echo off
title Akademia Ora - Dev Server
SET PATH=C:\Program Files\nodejs;%PATH%
cd /d "%~dp0"
echo.
echo  Akademia Ora - Duke startuar serverin...
echo  Pasi te shfaqet "Ready on http://localhost:3000"
echo  hap browserin dhe shko te localhost:3000
echo.
npm run dev
pause
