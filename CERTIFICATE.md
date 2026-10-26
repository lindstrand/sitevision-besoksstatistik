# Certifikat och signering

Sitevision kräver att WebApps som används i produktion är signerade med ett Sitevision-godkänt certifikat.

## Skaffa ett certifikat

1. Gå till [developer.sitevision.se](https://developer.sitevision.se/).
2. Logga in eller skapa ett konto.
3. Bli medlem i ett team.
4. Skapa ett certifikat på teamets sida.

Certifikatet hör till teamet och signeras av Sitevision.

Teamet har ett standardcertifikat. Det används automatiskt om du inte anger något annat certifikat när du signerar.

## Lägg certifikatet i Sitevision

Ladda ner certifikatets publika del från developer.sitevision.se.

Lägg sedan in det under:

**Webbplatsinställningar → Tilläggscertifikat**

Webbplatsen måste lita på samma certifikat som användes när widgeten signerades.

## Signera widgeten

Bygg först widgeten:

```powershell
npm.cmd ci
npm.cmd run build
```

Signera sedan:

```powershell
npm.cmd run sign
```

Du får logga in mot developer.sitevision.se och välja certifikat. Lämnar du certifikatnamnet tomt används teamets standardcertifikat.

Den signerade ZIP-filen skapas i `dist`.

På macOS och Linux använder du motsvarande kommandon utan `.cmd`:

```bash
npm ci
npm run build
npm run sign
```
