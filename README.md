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
- Sitevision Webbanalys med Piwik PRO
- tillägget **Piwik PRO - RESTApi** (`sv-piwik-pro-backend`)
- behörighet att hantera tillägg i Sitevision
- ett Sitevision-godkänt certifikat om widgeten ska användas i produktion

### Viktigt: tillåt POST i Piwik PRO - RESTApi

Widgeten hämtar statistik med POST-anrop. Därför måste tillägget **Piwik PRO - RESTApi** tillåta både GET och POST för inloggade användare.

I Sitevision:

1. Gå till **Tillägg**.
2. Öppna `sv-piwik-pro-backend`.
3. Välj **Egenskaper** och sedan **Restriktioner**.
4. För **Alla inloggade användare**, tillåt både **GET** och **POST**.

Om POST inte är tillåtet får widgeten fel **HTTP 405** och statistiken kan inte hämtas.

## Använd tillsammans med Skapa kampanjlänk

Besöksstatistik passar bra tillsammans med [Skapa kampanjlänk för Sitevision](https://github.com/lindstrand/Sitevision-kampanj).

**Skapa kampanjlänk** hjälper redaktörer att skapa enhetliga UTM-länkar och QR-koder. **Besöksstatistik** kan sedan visa kampanjtrafiken direkt i Sitevisions dashboard.

## Installera

Se [INSTALLATION.md](INSTALLATION.md) för hela installationen, inklusive hur du skaffar certifikat, bygger och signerar widgeten.

## Inställningar

I widgetens globala inställningar kan du bland annat välja:

- om sida eller gren ska vara förvald
- standardperiod
- hur många rader som ska visas
- vilka delar av statistiken som ska visas
- vilka URL:er som ska filtreras bort
- vilken Piwik PRO-dimension som innehåller Sitevisions PageID

Standard för PageID-dimensionen är `event_custom_dimension_1`.

Kontrollera att den dimensionen stämmer i er Piwik PRO-konfiguration.

## Bygga från källkod

Packa upp eller klona projektet i en ny, ren mapp och kör:

```powershell
npm.cmd ci
npm.cmd run build
```

På macOS eller Linux kan du använda:

```bash
npm ci
npm run build
```

Den färdiga ZIP-filen skapas i mappen `dist`.

## Säkerhet och integritet

Widgeten innehåller inga Piwik PRO-lösenord eller API-nycklar. Anslutningen till Piwik PRO går via Sitevisions centrala integration.

Widgeten använder Sitevisions `LogUtil` för teknisk loggning. Loggen innehåller inte rå Piwik-data, IP-adresser, användarnamn eller autentiseringsuppgifter.

Se [SECURITY.md](SECURITY.md) för mer information.
