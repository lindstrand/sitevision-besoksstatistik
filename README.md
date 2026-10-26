# Besöksstatistik för Sitevision

Besöksstatistik är en Sitevision **WebApps 2 Widget** för redaktörsstatistik från Sitevisions centrala Piwik PRO-integration.

Version 1.8.0 är den första stabila WebApps 2-releasen. Den bygger på den verifierade 1.7.15-kandidaten och behåller dess laddnings- och statistikflöde.

## Funktioner

- statistik för aktuell sida eller gren
- perioder från idag till ett år, föregående år och egna datum
- 30 dagar som standardperiod
- mest visade sidor, låg trafik och sidor utan registrerade besök
- enheter och länder
- trafikkällor med begripliga namn, till exempel Facebook och Instagram
- kampanjer och AI-trafik
- externa länkar och filer
- teknisk diagnostik som kan aktiveras vid felsökning

## Sitevision

Widgeten är en bundlad WebApps 2-app (`type: Widget`, `bundled: true`) och byggs med Sitevisions `sitevision-scripts`. Den renderas klientbaserat och använder Sitevisions Public API via `@sitevision/api`.

## Bygg alltid från en ren mapp

Blanda aldrig en ny release med en äldre arbetsmapp.

```powershell
npm.cmd ci
npm.cmd run build
```

Builden kör versions- och säkerhetskontroll innan Sitevisions build startar. Importpaketet skapas i `dist`.

## Konfiguration

Globala inställningar innehåller bland annat:

- standardläge sida/gren
- standardperiod
- antal rader
- vilka statistikpaneler som visas
- URL-filter
- querystring-undantag
- Piwik PRO-dimensionen som innehåller Sitevision PageID
- teknisk diagnostik

Standard för PageID-dimension är `event_custom_dimension_1`.

De URL-filter som passar Hässleholms kommuns installation ska granskas innan widgeten används i en annan organisation.

## Säkerhet och integritet

Piwik PRO-autentisering hanteras av Sitevisions centrala webbanalyskoppling. Widgeten ska inte innehålla Client ID, Client Secret eller andra Piwik-uppgifter.

Loggningen använder Sitevisions `LogUtil` och loggar endast appversion, generell feltyp och svarstid. Råa Piwik-svar, URL-parametrar, användaruppgifter, IP-adresser och autentiseringsuppgifter ska inte loggas.

Teknisk diagnostik är avstängd som standard.

Se `SECURITY.md`, `CERTIFICATE.md` och `RELEASE-CHECKLIST.md`.
