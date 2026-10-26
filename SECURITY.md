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

## Automatisk säkerhetskontroll

Om du bygger widgeten från källkoden körs en säkerhetskontroll automatiskt före build och signering.

Du kan också köra den manuellt:

```powershell
npm.cmd run check
```

Kontrollen letar efter vanliga typer av känsliga uppgifter och stoppar bygget om något sådant finns i projektmappen.
