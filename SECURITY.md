# Säkerhet och integritet

## Piwik PRO

Widgeten innehåller inga Piwik PRO-lösenord, Client ID eller Client Secret. Anslutningen går via Sitevisions centrala Piwik PRO-integration.

## Loggning

Widgeten använder Sitevisions `LogUtil`.

Loggen kan innehålla:

- appversion
- generell feltyp
- HTTP-status
- svarstid

Loggen innehåller inte:

- rå Piwik-data
- IP-adresser
- användarnamn
- cookies
- tokens
- lösenord
- fullständiga URL:er med querystring

## Länkar

Länkar från statistikdata görs bara klickbara när de använder `http` eller `https`. Relativa länkar används bara där widgeten behöver dem.

## Filer som inte ska publiceras

Lägg aldrig följande i GitHub:

- `.dev_properties.json`
- `.env`-filer
- privata nycklar
- certifikat
- tokens
- lösenord

## Kontroll före bygg och signering

Projektet har en automatisk kontroll som körs före build och signering:

```powershell
npm.cmd run check
```

Kontrollen stoppar bygget om den hittar vanliga typer av känsliga filer eller uppgifter.
