# Ändringslogg

## 1.8.0

- Första stabila WebApps 2-releasen.
- Bygger på den verifierade 1.7.15-kandidaten utan ändring av laddnings- eller statistikflöde.
- Lägger till dataminimerad `warn`-loggning för partiella Piwik-backendfel: endast HTTP-status, svarstid och sanerad feltyp.
- Inga URL:er, filter, PageID:n, Piwik-svar eller personuppgifter loggas.
- Lägger till separat dokumentation för certifikat och signering.
- Hässleholms kommuns certifikat publiceras inte i GitHub-repot.

## 1.7.15 RC

- Behåller 1.7.14:s verifierade laddningsflöde med separat `/statistics/core` och `/statistics`.
- Återför begripliga namn i **Kommer från**, bland annat Google, Direkttrafik, Facebook, Bing, Instagram och eMarketeer.
- Återför säker URL-validering för externa länkar och filer.
- Slår ihop externa länkar som endast skiljer sig genom HTML-kodning av `&`.
- Gör Piwik PRO-dimensionen för Sitevision PageID konfigurerbar.
- Standardperiod ändras till 30 dagar.
- Behåller Envision-/Dashboard-anpassad styling, fokusmarkering och container queries.
- Förtydligar GitHub-, säkerhets-, integritets-, release- och signeringsrutiner.
- Referral/autentiseringsändringen från 1.7.4/1.7.5 ingår inte ännu eftersom den förändrar statistikens semantik och ska verifieras separat.

## 1.7.14 RC

- Grundstatistiken har nu en egen WebApps 2-route: `/statistics/core`.
- Klienten skickar inte längre `svstat_core=1`.
- `/statistics/core` tvingar servern att köra endast grundstatistik.
- `/statistics` kör alltid den fullständiga statistiken.
- Detta förhindrar att första anropet av misstag kör full statistik och därefter startar ännu ett fullständigt anrop.
- Ingen ändring av Piwik-frågor, grenfilter, periodlogik eller statistikberäkningar.
- Behåller 1.6.15:s periodbadge och informativa progressvisning.

## 1.7.13 RC

- Återställer exakt 1.6.15:s robusta visning/döljning av laddningsstatus.
- `setStatus` använder explicit `display: flex`.
- `hideStatus` använder explicit `display: none`.
- Ingen ändring av Piwik-frågor, statistikmotor, grenfilter eller progressiva tvåstegsladdning.
- Bygger vidare på 1.7.12:s 1.6.15-baserade WebApps 2-portning.

## 1.7.12 RC

- WebApps 2-byggskal med 1.6.15 som funktionellt facit.
- Statistikmotor, periodetikett och progressiv laddningsmodell hämtas från 1.6.15.
- Återställer periodbadge uppe till höger, till exempel "Senaste 30 avslutade dagarna".
- Återställer informativa laddningssteg från 1.6.15.
- Inga referral-förändringar från 1.7.4/1.7.5.
- Sitevision LogUtil används med dataminimerad loggning.
- Versions- och säkerhetskontroll körs före build/signering.
