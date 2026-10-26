# Installera Besöksstatistik

## Innan du börjar

Kontrollera att:

1. Piwik PRO är kopplat till Sitevision.
2. Du har behörighet att hantera tillägg.
3. Du har en version av widgeten som är signerad med ett certifikat som webbplatsen litar på.

I en produktionsmiljö kräver Sitevision att WebApps är signerade med ett Sitevision-godkänt certifikat.

## Installera en färdig signerad version

1. Öppna **Tillägg** i Sitevision.
2. Skapa eller välj ett tillägg för dashboard-widgeten.
3. Importera den signerade ZIP-filen.
4. Aktivera den nya versionen.
5. Lägg till widgeten i en dashboard.
6. Öppna widgetens globala inställningar och kontrollera Piwik PRO-inställningarna.

Om Sitevision säger att certifikatet inte är betrott måste certifikatet som användes vid signeringen först läggas till under webbplatsens betrodda tilläggscertifikat.

## Bygg och signera själv

Installera Node.js och packa upp källkoden i en ny, tom mapp.

Kör:

```powershell
npm.cmd ci
npm.cmd run build
```

Kontrollera att bygget avslutas utan fel.

Signera sedan med ert eget Sitevision-certifikat:

```powershell
npm.cmd run sign
```

Den signerade filen skapas i `dist`.

Certifikatet som används vid signeringen måste också vara installerat som betrott tilläggscertifikat på webbplatsen där widgeten ska användas.

## Ställ in widgeten

När widgeten är installerad bör du kontrollera de globala inställningarna.

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

Om er Sitevision-installation använder en annan Piwik PRO-dimension behöver den ändras.

## Testa efter installation

Testa gärna både:

- **Denna sida**
- **Denna gren**
- 30 dagar
- en större gren med många sidor

Kontrollera att statistiken laddas klart och att siffrorna stämmer mot Piwik PRO.
