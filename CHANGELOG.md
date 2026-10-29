# Ändringslogg

## 1.9.0

- Lägger till en graf över sidvisningar över tid för både aktuell sida och gren.
- Visar idag per timme, kortare perioder per dag och längre perioder per vecka eller månad.
- Grafen använder samma Piwik-filter som totalsiffrorna i widgeten.
- Lägger till **Skriv ut / spara som PDF** som skapar en ren rapportvy för webbläsarens utskriftsfunktion.
- Rapportvyn tar bort dashboardkontroller och visar hela listor som annars ligger bakom ”Visa fler”.

## 1.8.2

- Slår ihop samma Sitevision-fil när den nås via flera domäner men har samma `/download/...`-sökväg.
- Visar en försiktig nedre gräns för unika filklick när flera domänvarianter har slagits ihop.
- Förbättrar visningen av långa externa länkar genom att behålla både början och slutet av adressen.
- Visar ReadSpeaker-länkar med namnet på sidan som lästes upp när det kan utläsas ur länken.

## 1.8.1

- Rättar grenstatistiken så att vanliga grenar alltid avgränsas med Sitevision-ID:n.
- Tar bort URL-prefix som alternativt grenfilter.
- Historisk trafik följer därmed samma sida även om sidans URL har ändrats.
- Förhindrar att "Denna gren" kan visa färre sidvisningar än grensidan själv på grund av olika avgränsningsmetoder.

## 1.8.0

- Första publicerade versionen.
- Visar statistik för aktuell sida eller gren.
- 30 dagar är standardperiod.
- Visar bland annat mest visade sidor, låg trafik, sidor utan besök, enheter, länder, trafikkällor, kampanjer, AI-trafik, externa länkar och filer.
- Begripliga namn används för vanliga trafikkällor, till exempel Facebook och Instagram.
- Piwik PRO-dimensionen för Sitevision PageID kan ställas in.
- Tekniska fel och långsamma anrop loggas med Sitevisions `LogUtil`.
- Inga autentiseringsuppgifter eller rå Piwik-data skrivs till loggen.
