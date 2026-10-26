# Installera Besöksstatistik

Den här guiden beskriver hela vägen från Piwik PRO och certifikat till en installerad widget i Sitevision.

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

Gör så här:

1. Gå till [developer.sitevision.se](https://developer.sitevision.se/).
2. Logga in eller skapa ett konto.
3. Bli medlem i ett team. Certifikat i Sitevision hör alltid till ett team.
4. Öppna teamets sida.
5. Skapa ett certifikat.

När du skapar certifikatet anger du ett namn för certifikatet. Sitevision signerar certifikatet så att det kan användas för WebApps i produktion.

Ett av teamets certifikat är valt som standard. Om du inte anger något certifikatnamn när du signerar används standardcertifikatet.

## 3. Lägg certifikatet på webbplatsen

Ladda ner certifikatets publika del från teamets sida på developer.sitevision.se.

I Sitevision:

1. Öppna **Webbplatsinställningar**.
2. Gå till **Tilläggscertifikat**.
3. Lägg till certifikatet bland de betrodda certifikaten.

Det certifikat som används när widgeten signeras måste finnas här, annars går den signerade widgeten inte att använda på webbplatsen.

## 4. Hämta källkoden

Ladda ner källkoden från GitHub och packa upp den i en ny, tom mapp.

Du behöver Node.js och npm installerat.

## 5. Installera beroenden

I Windows PowerShell:

```powershell
npm.cmd ci
```

På macOS eller Linux:

```bash
npm ci
```

## 6. Bygg widgeten

I Windows:

```powershell
npm.cmd run build
```

På macOS eller Linux:

```bash
npm run build
```

Bygget kör också projektets versions- och säkerhetskontroll.

När bygget är klart finns ZIP-filen i mappen `dist`.

## 7. Signera widgeten

I Windows:

```powershell
npm.cmd run sign
```

På macOS eller Linux:

```bash
npm run sign
```

Du får ange användarnamn och lösenord för developer.sitevision.se.

Du får också frågan:

```text
Certificate name for signing (blank for default)
```

Tryck Enter om du vill använda teamets standardcertifikat. Annars anger du namnet på det certifikat du vill använda.

När signeringen lyckas skapas en signerad ZIP-fil i `dist`.

## 8. Installera den signerade widgeten

1. Öppna **Tillägg** i Sitevision.
2. Skapa eller välj tillägget där widgeten ska ligga.
3. Importera den signerade ZIP-filen från `dist`.
4. Aktivera den nya versionen.
5. Lägg till widgeten i en dashboard.

## 9. Kontrollera widgetens inställningar

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

## 10. Testa

Testa gärna:

- **Denna sida**
- **Denna gren**
- 30 dagar
- en större gren med många sidor

Kontrollera att statistiken laddas klart och att siffrorna ser rimliga ut.

Om nästan all statistik misslyckas och den tekniska diagnostiken visar **HTTP 405**, kontrollera först att POST är tillåtet i `sv-piwik-pro-backend`.
