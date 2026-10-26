# Certifikat

Sitevision kräver att WebApps som används i produktion är signerade med ett Sitevision-godkänt certifikat.

## Om du bygger widgeten själv

Signera den med ett certifikat som tillhör ert Sitevision-team:

```powershell
npm.cmd run sign
```

Certifikatet som används vid signeringen måste också finnas bland webbplatsens betrodda tilläggscertifikat.

## Viktigt

Lägg aldrig privata nycklar, inloggningsuppgifter eller andra hemligheter i GitHub.

Det här projektet innehåller inget certifikat.
