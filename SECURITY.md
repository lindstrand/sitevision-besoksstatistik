# Säkerhet och integritet

## Hemligheter

Repositoryt får aldrig innehålla:

- Sitevision-administratörsuppgifter
- `.dev_properties.json`
- `.env`-filer
- Piwik PRO Client ID eller Client Secret
- access tokens eller Bearer tokens
- certifikatfiler och privata nycklar, om inte publicering av en specifik publik certifikatdel har beslutats separat
- lokala användarsökvägar
- interna privata IP-adresser

Piwik PRO-autentisering tillhör Sitevisions centrala webbanalyskonfiguration och ska inte lagras i widgeten.

## Loggning

Serverloggning ska ske med Sitevisions `LogUtil`.

Normal loggning får innehålla:

- appversion
- generell händelse/feltyp
- svarstid

Normal loggning får inte innehålla:

- råa Piwik-svar
- cookies eller sessionsidentifierare
- IP-adresser
- användarnamn eller personuppgifter
- tokens, lösenord eller hemligheter
- fullständiga URL:er med querystring

Teknisk diagnostik i gränssnittet är avstängd som standard och ska endast aktiveras tillfälligt av administratör vid felsökning.

## Länkar

URL:er som kommer från statistikdata får bara göras klickbara om de använder `http` eller `https`. Relativa länkar tillåts endast där funktionen uttryckligen behöver dem.

## Dependency-kontroll

Kör vid varje release:

```powershell
npm.cmd ci
npm.cmd audit
npm.cmd run build
```

En release ska inte publiceras om npm rapporterar en känd sårbarhet utan att den först bedömts och dokumenterats.

## Rapportera säkerhetsproblem

Publicera inte autentiseringsuppgifter, personuppgifter eller exploateringsdetaljer i ett publikt GitHub-ärende. Använd en privat kontaktväg eller GitHubs privata vulnerability reporting om det aktiveras.
