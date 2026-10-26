# Besöksstatistik för Sitevision

Besöksstatistik är en dashboard-widget för Sitevision. Den visar besöksstatistik från Piwik PRO direkt i Sitevision, så att redaktörer kan se hur en sida eller en hel gren används.

## Det här visar widgeten

- sidvisningar, besök och unika besökare
- mest visade sidor
- sidor med låg trafik
- sidor utan registrerade besök
- enheter och länder
- var besökarna kommer från
- kampanjer
- trafik från AI-tjänster
- klick på externa länkar
- klick på filer

Standardperioden är 30 dagar.

## Krav

Du behöver:

- Sitevision med stöd för WebApps 2 och dashboard-widgets
- Piwik PRO kopplat till Sitevision
- behörighet att hantera tillägg i Sitevision
- ett Sitevision-godkänt certifikat om du ska använda widgeten i produktion

## Installera

Se [INSTALLATION.md](INSTALLATION.md) för steg-för-steg-instruktioner.

## Inställningar

I widgetens globala inställningar kan du bland annat välja:

- om sida eller gren ska vara förvald
- standardperiod
- hur många rader som ska visas
- vilka delar av statistiken som ska visas
- vilka URL:er som ska filtreras bort
- vilken Piwik PRO-dimension som innehåller Sitevisions PageID

Standard för PageID-dimensionen är `event_custom_dimension_1`.

Kontrollera alltid att den dimensionen stämmer i er Piwik PRO-konfiguration.

## Bygga från källkod

Packa upp eller klona projektet i en ren mapp och kör:

```powershell
npm.cmd ci
npm.cmd run build
```

Den färdiga ZIP-filen skapas i mappen `dist`.

Bygg alltid varje version i en ny, ren mapp. Då minskar risken att gamla filer följer med av misstag.

## Säkerhet och integritet

Widgeten innehåller inga Piwik PRO-lösenord eller API-nycklar. Anslutningen till Piwik PRO går via Sitevisions centrala integration.

Widgeten använder Sitevisions `LogUtil` för teknisk loggning. Loggen innehåller inte rå Piwik-data, IP-adresser, användarnamn eller autentiseringsuppgifter.

Se [SECURITY.md](SECURITY.md) för mer information.
