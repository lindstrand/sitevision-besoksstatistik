# Certifikat och signering

## Hässleholms kommuns certifikat

Hässleholms kommun använder ett eget Sitevision-signerat produktionscertifikat för sina appar. Certifikatet kan användas för flera av kommunens egna Sitevision-appar.

Certifikatfiler, privata nycklar och signeringsuppgifter ska **inte** lagras i detta GitHub-repository i den här releasen. Även en publik certifikatdel publiceras först efter ett separat uttryckligt beslut.

## Distribution till andra kommuner

En signerad release kan installeras på en annan Sitevision-webbplats om mottagaren uttryckligen väljer att lita på det certifikat som releasen är signerad med. Hur den publika certifikatdelen distribueras ska därför beslutas separat från källkoden.

För vänkommuner kan installation och certifikathantering ske manuellt i samråd med Hässleholms kommun. Om widgeten senare får bredare spridning bör ett separat produktionscertifikat för modulen övervägas.

## Förbjudet i GitHub

Följande får aldrig committas:

- privata nycklar
- certifikatfiler som inte uttryckligen beslutats vara publika
- `.dev_properties.json`
- `.env`-filer
- Sitevision-inloggningar
- tokens eller andra signeringshemligheter

## Signering

Signera endast en version som redan har byggts och funktionstestats från en ren arbetsmapp:

```powershell
npm.cmd run sign
```

`presign` kör samma versions- och säkerhetskontroller som builden.
