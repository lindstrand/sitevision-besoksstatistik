# Release-checklista

## 1. Ny ren arbetsmapp

Skapa alltid en ny mapp för varje version. Kopiera eller packa upp endast den aktuella releasekällan.

Lägg aldrig en ny version ovanpå en äldre arbetsmapp.

## 2. Kontrollera versionsnummer

Följande ska ha samma version:

- `manifest.json`
- `package.json`
- `package-lock.json`
- `APP_VERSION` i `src/index.js`

`npm.cmd run build` kör kontrollen automatiskt.

## 3. Installera reproducerbart

```powershell
npm.cmd ci
```

Använd `npm ci`, inte en gammal `node_modules`-mapp från en tidigare version.

## 4. Säkerhetskontroll

```powershell
npm.cmd audit
npm.cmd run check
```

Kontrollera särskilt att inga utvecklaruppgifter, `.dev_properties.json`, `.env`, tokens, privata nycklar eller interna miljöuppgifter ingår.

## 5. Bygg

```powershell
npm.cmd run build
```

Builden ska avslutas med `Compression successful`.

## 6. Testa i Sitevision

Importera ZIP-filen från `dist`.

Aktivera uttryckligen den nya versionen i Sitevision innan test.

Testa minst:

- Denna sida, 30 dagar
- Denna gren, 30 dagar
- en större gren
- periodbyte
- Visa fler
- externa länkar och filer
- att progressindikeringen avslutas
- att apploggen inte innehåller känslig information

## 7. GitHub

Kontrollera alltid före commit:

```powershell
git status
```

`node_modules`, `dist`, `.dev_properties.json`, `.env`, certifikat och privata nycklar ska inte finnas bland filerna som committas. Se även `CERTIFICATE.md`.

## 8. Signering

Signera först den verifierade releasekandidaten:

```powershell
npm.cmd run sign
```

Använd ett Sitevision-signerat produktionscertifikat som är installerat som betrott Addon certificate på målwebbplatsen.

Signera inte en annan lokal build än den som funktionstestats.
