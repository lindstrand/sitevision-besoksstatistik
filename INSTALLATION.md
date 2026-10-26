# Installera Besöksstatistik

Den här guiden beskriver hela vägen från Piwik PRO och certifikat till en installerad widget i Sitevision.

Du behöver inte ha arbetat med Sitevision-utveckling tidigare. Följ stegen i ordning.

## 1. Kontrollera Piwik PRO i Sitevision

Widgeten använder Sitevisions egen koppling till Piwik PRO.

Kontrollera att Piwik PRO är konfigurerat under:

**Webbplatsinställningar → Integration → Webbanalys**

Du behöver också tillägget **Piwik PRO - RESTApi** (`sv-piwik-pro-backend`) från Sitevision Marketplace.

### Tillåt GET och POST

Det här är viktigt. Widgeten använder POST för att hämta statistik.

1. Gå till **Tillägg** i Sitevision.
2. Öppna `sv-piwik-pro-backend`.
3. Välj **Egenskaper → Restriktioner**.
4. För **Alla inloggade användare**, tillåt både **GET** och **POST**.

GET är normalt redan tillåtet. Om POST saknas får widgeten **HTTP 405** och statistiken kan inte hämtas.

## 2. Skaffa ett Sitevision-certifikat

WebApps som ska användas på en produktionswebbplats måste signeras med ett certifikat som är godkänt av Sitevision.

1. Gå till [developer.sitevision.se](https://developer.sitevision.se/).
2. Logga in eller skapa ett konto.
3. Bli medlem i ett team.
4. Öppna teamets sida.
5. Skapa ett certifikat.

Certifikatet hör till teamet. Ett av teamets certifikat är standardcertifikat och används om du inte väljer något annat när du signerar.

## 3. Lägg certifikatet på webbplatsen

Ladda ner certifikatets publika del från teamets sida på developer.sitevision.se.

I Sitevision:

1. Öppna **Webbplatsinställningar**.
2. Gå till **Tilläggscertifikat**.
3. Lägg till certifikatet bland de betrodda certifikaten.

Webbplatsen måste lita på samma certifikat som används när widgeten signeras.

## 4. Installera Node.js

För att bygga widgeten på din dator behöver du **Node.js**.

Node.js innehåller också **npm**, som används för att hämta de paket som projektet behöver och för att köra byggkommandona.

Sitevisions nuvarande utvecklingsverktyg kräver Node.js 20.9 eller senare.

1. Gå till [nodejs.org](https://nodejs.org/).
2. Installera en aktuell LTS-version av Node.js.
3. Använd standardvalen i installationen.

När installationen är klar öppnar du **PowerShell** i Windows.

Skriv:

```powershell
node --version
npm --version
```

Om båda kommandona visar ett versionsnummer är installationen klar.

Exempel:

```text
v22.x.x
10.x.x
```

Versionsnumren behöver inte vara exakt samma som i exemplet.

## 5. Hämta källkoden

På GitHub väljer du:

**Code → Download ZIP**

Packa upp ZIP-filen i en ny mapp.

Du behöver inte ha Git installerat för att bygga widgeten.

## 6. Öppna PowerShell i projektmappen

Det enklaste i Windows är att öppna den uppackade projektmappen i Utforskaren.

Klicka sedan i adressfältet, skriv:

```text
powershell
```

och tryck Enter.

Då öppnas PowerShell direkt i rätt mapp.

Du kan också öppna PowerShell först och gå till mappen med `cd`.

Exempel:

```powershell
cd C:\Users\dittnamn\Downloads\sitevision-besoksstatistik
```

Kontrollera att du är i rätt mapp. Där ska bland annat `package.json`, `manifest.json` och mappen `src` finnas.

## 7. Installera projektets paket

Kör:

```powershell
npm.cmd ci
```

Kommandot läser `package-lock.json` och installerar de paket som behövs för att bygga widgeten.

Det kan ta en stund första gången.

Varningar om äldre beroenden kan förekomma. Det viktiga är att kommandot avslutas utan fel.

## 8. Bygg widgeten

Kör:

```powershell
npm.cmd run build
```

Bygget:

1. kontrollerar versionsnumret
2. kör projektets säkerhetskontroll
3. kompilerar JavaScript och CSS
4. skapar en Sitevision-ZIP

När bygget lyckas skapas mappen:

```text
dist
```

Där finns den byggda ZIP-filen.

En lyckad build avslutas normalt med:

```text
Compression successful
```

Den osignerade ZIP-filen kan användas i en utvecklingsmiljö som tillåter osignerade appar.

För produktion behöver appen signeras.

## 9. Signera widgeten

Stå kvar i samma PowerShell-fönster och kör:

```powershell
npm.cmd run sign
```

Du får ange användarnamn och lösenord för developer.sitevision.se.

Sedan får du frågan:

```text
Certificate name for signing (blank for default)
```

Tryck Enter om du vill använda teamets standardcertifikat.

Om du vill använda ett annat certifikat skriver du certifikatets namn.

När signeringen lyckas visas ett meddelande som liknar:

```text
Signing successful
```

Den signerade ZIP-filen skapas i `dist` och har normalt `-signed` i filnamnet.

Det är den signerade filen du ska använda i produktion.

## 10. Installera den signerade widgeten

1. Öppna **Tillägg** i Sitevision.
2. Skapa eller välj tillägget där widgeten ska ligga.
3. Importera den signerade ZIP-filen från `dist`.
4. Aktivera den nya versionen.
5. Lägg till widgeten i en dashboard.

Glöm inte att aktivera den importerade versionen.

## 11. Kontrollera widgetens inställningar

Viktigast är:

- standardperiod
- standardläge: sida eller gren
- Piwik PRO-dimension för Sitevision PageID
- vilka statistikdelar som ska visas
- URL-filter

Standard för PageID-dimensionen är:

```text
event_custom_dimension_1
```

Om er Piwik PRO-installation använder en annan dimension behöver den ändras i widgetens globala inställningar.

## 12. Testa

Testa gärna:

- **Denna sida**
- **Denna gren**
- 30 dagar
- en större gren med många sidor

Kontrollera att statistiken laddas klart och att siffrorna ser rimliga ut.

Om nästan all statistik misslyckas och den tekniska diagnostiken visar **HTTP 405**, kontrollera först att POST är tillåtet i `sv-piwik-pro-backend`.

## macOS och Linux

Guiden ovan använder PowerShell eftersom den är skriven för Windows.

På macOS och Linux använder du Terminal och samma npm-kommandon utan `.cmd`:

```bash
npm ci
npm run build
npm run sign
```
