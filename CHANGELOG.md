# Ändringslogg

## 1.8.1

- Rättar grenstatistiken så att vanliga grenar alltid avgränsas med Sitevision-ID:n.
- Tar bort URL-prefix som alternativt grenfilter.
- Historisk trafik följer därmed samma sida även om sidans URL har ändrats.
- Förhindrar att "Denna gren" kan visa färre sidvisningar än grensidan själv på grund av olika avgränsningsmetoder.
- Övrig statistiklogik och frågor, inklusive AI-trafik, är oförändrade.

## 1.8.0

- Första publicerade versionen.
- Visar statistik för aktuell sida eller gren.
- 30 dagar är standardperiod.
- Visar bland annat mest visade sidor, låg trafik, sidor utan besök, enheter, länder, trafikkällor, kampanjer, AI-trafik, externa länkar och filer.
- Begripliga namn används för vanliga trafikkällor, till exempel Facebook och Instagram.
- Piwik PRO-dimensionen för Sitevision PageID kan ställas in.
- Tekniska fel och långsamma anrop loggas med Sitevisions `LogUtil`.
- Inga autentiseringsuppgifter eller rå Piwik-data skrivs till loggen.
