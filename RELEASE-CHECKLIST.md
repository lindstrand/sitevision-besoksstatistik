# Checklista för en ny version

Den här checklistan är till för den som utvecklar eller publicerar widgeten.

## 1. Börja i en ren mapp

Skapa en ny mapp för varje version. Lägg inte nya filer ovanpå en gammal arbetsmapp.

## 2. Kontrollera versionen

Samma versionsnummer ska finnas i:

- `manifest.json`
- `package.json`
- `package-lock.json`
- `APP_VERSION` i `src/index.js`

Kontrollen görs automatiskt vid build.

## 3. Installera beroenden

```powershell
npm.cmd ci
```

## 4. Kör kontrollerna

```powershell
npm.cmd audit
npm.cmd run check
```

## 5. Bygg

```powershell
npm.cmd run build
```

Bygget ska avslutas med `Compression successful`.

## 6. Testa i Sitevision

Importera ZIP-filen från `dist` och aktivera den nya versionen.

Testa minst:

- Denna sida, 30 dagar
- Denna gren, 30 dagar
- en större gren
- periodbyte
- Visa fler
- externa länkar
- filer
- att laddningen avslutas

## 7. Publicera källkoden

Kontrollera att följande inte finns med:

- `node_modules`
- `dist`
- `.dev_properties.json`
- `.env`
- certifikat
- privata nycklar

## 8. Signera

När versionen är testad:

```powershell
npm.cmd run sign
```

Testa den signerade versionen innan den används i produktion.
