# Udhëzuesi i Instalimit — Akademia Ora

## Hapi 1: Instalo Node.js

1. Shko te: https://nodejs.org
2. Shkarko versionin **LTS** (Long Term Support)
3. Instalo duke ndjekur udhëzimet
4. Rinis kompjuterin pas instalimit

## Hapi 2: Hap PowerShell / Terminal

Klike me të djathtë në Desktop → "Open in Terminal" OSE hap "Windows Terminal" / "PowerShell"

## Hapi 3: Shko te dosja e projektit

```powershell
cd "C:\Users\Akademia Ora\Desktop\Sistemi Ora"
```

## Hapi 4: Instalo paketat

```powershell
npm install
```

(Prit 1-2 minuta)

## Hapi 5: Krijo bazën e të dhënave

```powershell
npx prisma db push
```

## Hapi 6: Ngarko të dhënat demo

```powershell
npm run db:seed
```

## Hapi 7: Fillo serverin

```powershell
npm run dev
```

## Hapi 8: Hap shfletuesin

Shko te: **http://localhost:3000**

---

## Kredencialet

| Roli | Email | Fjalëkalimi |
|------|-------|-------------|
| Admin | admin@akademiaora.al | admin123 |
| Financë | finance@akademiaora.al | finance123 |
| Sekretari | sekretari@akademiaora.al | secret123 |

---

## Komanda të dobishme

```powershell
# Fillo serverin
npm run dev

# Shiko bazën e të dhënave (interface grafike)
npm run db:studio

# Rikrijo bazën e të dhënave (fshin të gjitha të dhënat!)
npx prisma db push --force-reset
npm run db:seed
```

## Ndalo serverin
Shtyp **Ctrl+C** në terminal

---

## Çfarë nëse ka problem?

1. Sigurohu që Node.js është instaluar: `node --version`
2. Sigurohu që je në dosjen e duhur: shiko nëse ekziston `package.json`
3. Provo: `npm install` sërish
