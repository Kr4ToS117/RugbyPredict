# Mode d'emploi utilisateur — Obtention des secrets et tokens

Ce guide explique comment récupérer les secrets nécessaires pour exécuter la plateforme RugbyPredict avec des flux de données réels. Chaque section indique les étapes administratives, les contacts possibles et la façon de stocker les variables d'environnement.

> 💡 **Important** : Conservez tous les tokens et clés d'API dans un coffre-fort (Replit Secrets Manager, 1Password, Vault, etc.) et ne les committez jamais dans Git.

## 1. Préparer la gestion des secrets

1. **Choisir un coffre-fort** :
   - Sur Replit : ouvrez votre projet ▶️ onglet **Secrets** ▶️ cliquez sur **+ New secret**.
   - En local : utilisez un fichier `.env` ignoré par Git (`cp .env.example .env`).
2. **Lister les variables à renseigner** (voir tableau récapitulatif ci-dessous).
3. **Identifier les propriétaires internes** : notez qui est responsable de chaque abonnement (Data, Trading, Ops) pour faciliter les renouvellements annuels.

## 2. Fédérations / Rugby API (`RUGBY_API_URL`, `RUGBY_API_TOKEN`)

1. **Choisir le fournisseur** : World Rugby, LNR (Top 14/Pro D2), EPCR, URC ou un agrégateur (Stats Perform, SportRadar). Sélectionnez la source couvrant vos compétitions prioritaires.
2. **Démarches** :
   - Contacter le service commercial via le formulaire "Media/Data" du site fédération.
   - Signer l'accord de licence et obtenir les identifiants d'accès (client ID/secret ou token Bearer).
3. **Générer le token** :
   - Pour les APIs OAuth2, appelez l'endpoint `POST /oauth/token` (client_credentials) et notez le `access_token`.
   - Pour les APIs statiques, le token est fourni directement.
4. **Configurer** :
   - `RUGBY_API_URL` → URL racine (ex. `https://api.lnr.fr/v1`).
   - `RUGBY_API_TOKEN` → token Bearer valide.

## 3. Bookmakers / Odds API (`ODDS_API_URL`, `ODDS_API_TOKEN`)

1. **Fournisseurs courants** : OddsJam, Pinnacle API, BetFair Historical, SportRadar Odds. Choisissez un partenaire autorisé dans votre juridiction.
2. **Processus** :
   - Ouvrir un compte B2B et valider la conformité (KYC).
   - Souscrire au plan "Pre-match Rugby Union" ou équivalent.
3. **Token** : récupérez la clé API fournie dans le portail client, parfois appelée `X-API-Key`.
4. **Configuration** :
   - `ODDS_API_URL` → URL base (ex. `https://api.pinnacle.com/v3`).
   - `ODDS_API_TOKEN` → clé API.

## 4. Météo (`WEATHER_API_URL`, `WEATHER_API_TOKEN`)

1. **Fournisseurs recommandés** : Meteomatics, Tomorrow.io, OpenWeather (One Call). Assurez-vous que la couverture mondiale et la granularité horaire répondent aux besoins.
2. **Étapes** :
   - Créer un compte développeur.
   - Générer une clé API via le portail.
3. **Configuration** :
   - `WEATHER_API_URL` → endpoint base (ex. `https://api.tomorrow.io/v4`).
   - `WEATHER_API_TOKEN` → clé API.

## 5. Proxy de scraping (`SCRAPER_PROXY_URL`, `SCRAPER_PROXY_TOKEN`)

Pour les sources sans API officielle :
1. Souscrire à un service de proxy rotatif (ScrapeOps, Zyte, Bright Data) ou déployer votre proxy headless.
2. Récupérer l'URL et le token d'authentification.
3. Déclarer :
   - `SCRAPER_PROXY_URL` → entrée HTTPS (ex. `https://proxy.scrapeops.io`).
   - `SCRAPER_PROXY_TOKEN` → clé d'accès.

## 6. Notifications (`ETL_EMAIL_WEBHOOK`, `ETL_SLACK_WEBHOOK`, `ETL_TELEGRAM_BOT_TOKEN`, `ETL_TELEGRAM_CHAT_ID`)

1. **Email** : créer un webhook via un service type Mailgun/SendGrid ou une fonction serverless.
2. **Slack** : ajouter l'application "Incoming Webhook" à votre workspace et récupérer l'URL.
3. **Telegram** :
   - Créer un bot avec `@BotFather` (commande `/newbot`).
   - Noter le `bot_token`.
   - Obtenir l'identifiant de chat (`chat_id`) via `GET https://api.telegram.org/bot<token>/getUpdates`.

## 7. Base de données et stockage (`DATABASE_URL`, `STORAGE_ROOT`)

1. **Postgres managé** :
   - Créer une base (Render, Supabase, Neon, RDS).
   - Récupérer la chaîne de connexion `postgres://user:password@host:port/db`.
2. **Stockage d'exports** :
   - Définir `STORAGE_ROOT` (chemin local) ou configurer un bucket S3/Backblaze (adapter le code si nécessaire).

## 8. Paramètres bankroll & modèles

Les variables suivantes n'exigent pas de fournisseurs externes mais doivent être ajustées :

| Variable | Description | Valeur par défaut |
| --- | --- | --- |
| `STARTING_BANKROLL` | Capital initial | `1000` |
| `LEAGUE_EXPOSURE_LIMIT` | Exposition max par ligue | `0.3` |
| `TEAM_EXPOSURE_LIMIT` | Exposition max par équipe | `0.15` |
| `WEEKLY_STOP_LOSS` | Perte max hebdomadaire | `0.1` |
| `FIXED_PERCENT_STAKE` | % fixe par pari | `0.02` |
| `FLAT_STAKE_AMOUNT` | Mise fixe | `25` |
| `KELLY_FRACTION` | Fraction Kelly | `0.5` |
| `MODEL_ALGO` | Algo entraînement (`logit`, `gbdt`) | `gbdt` |
| `MODEL_CALIBRATION` | Méthode (`platt`, `isotonic`) | `platt` |

## 9. Enregistrer les secrets

- **Replit** : pour chaque variable, créez une entrée dans l'onglet Secrets.
- **Local** : ajoutez les lignes correspondantes dans `.env` puis exécutez `source .env` (Unix) ou utilisez `direnv`.

## 10. Vérification rapide

1. Lancez `pnpm prisma migrate deploy` (ou `drizzle-kit push`) pour appliquer les migrations.
2. Exécutez `pnpm seed` si un script de seed est disponible.
3. Démarrez les jobs (`pnpm dev` ou `pnpm start`). Les logs doivent confirmer la connexion à chaque API.
4. Surveillez la page **Settings → Secrets** dans l'UI pour vérifier que tous les connecteurs signalent un statut ✅.

---

Pour toute question ou renouvellement, documentez les contacts dans un tableau interne et planifiez les rappels 30 jours avant expiration des tokens.
