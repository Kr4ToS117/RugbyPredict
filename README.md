# RugbyPredict

Ce projet fournit une API Express et une application Vite pour gérer des prédictions autour des compétitions de rugby. La base de données Postgres est pilotée par [Drizzle ORM](https://orm.drizzle.team/).

## Pré-requis

- Node.js 20+
- Une instance PostgreSQL accessible et l'environnement `DATABASE_URL` configuré.

## Migrations Drizzle

1. Modifiez le schéma dans `shared/schema.ts`.
2. Générez un nouveau fichier SQL via:

   ```bash
   npx drizzle-kit generate
   ```

3. Appliquez les migrations sur la base ciblée une fois validées :

   ```bash
   npx drizzle-kit push
   ```

4. Commitez les fichiers créés dans `migrations/` ainsi que les mises à jour du schéma.

## Peuplement de données de démonstration

Un script de seed est disponible pour injecter une saison de démonstration, des équipes et des données associées :

```bash
npx tsx server/db/seed.ts
```

> ⚠️ Assurez-vous que `DATABASE_URL` pointe vers une base dédiée au développement avant d'exécuter le seed.

## Architecture back-end

- `shared/schema.ts` centralise la définition des tables, relations et types partagés.
- `server/services/users.ts` expose un repository utilisateur basé sur Drizzle injectable dans les routes et services.
- `server/db/seed.ts` orchestre l'initialisation d'une saison témoin, des lineups, événements, cotes, météo et prédictions pour alimenter rapidement l'application.
- `server/models/features.ts` calcule les features agrégées (forme, Elo, repos, météo, cotes implicites, head-to-head) en veillant à ne jamais consommer de données postérieures au coup d'envoi du match concerné.
- `server/models/training.ts` entraîne des modèles logit ou gradient boosting avec split chronologique, calibrage (Platt/isotonic) et génération automatique des métriques/backtests.
- `server/services/models.ts` gère l'enregistrement des versions, l'insertion des prédictions, la promotion/rollback et l'accès aux métriques pour l'UI.
- `server/services/fixtures.ts` assemble les fixtures avec les prédictions du modèle de production.

## Démarrer le serveur

```bash
npm install
npm run dev
```

Le serveur Express et le client Vite sont disponibles sur le port défini par la variable `PORT` (5000 par défaut).

## Setup local complet

1. **Configurer les secrets** – créer un fichier `.env` en vous basant sur l'exemple ci-dessous :

   ```env
   DATABASE_URL=postgres://user:password@localhost:5432/rugby
   STARTING_BANKROLL=1000
   LEAGUE_EXPOSURE_LIMIT=0.3
   TEAM_EXPOSURE_LIMIT=0.15
   WEEKLY_STOP_LOSS=0.1
   FIXED_PERCENT_STAKE=0.02
   FLAT_STAKE_AMOUNT=25
   KELLY_FRACTION=0.5
   LOG_LEVEL=info
   LOG_PRETTY=true
   ```

   Ces variables contrôlent les limites de risk-management du service bankroll ainsi que la verbosité des logs structurés.

2. **Installer les dépendances** : `npm install`.
3. **Appliquer les migrations Drizzle** avec `npm run db:push` pour synchroniser le schéma.
4. **(Optionnel) Alimenter la base** via `npx tsx server/db/seed.ts`.
5. **Lancer les tests** (voir section suivante) avant toute contribution.

### Scripts de contrôle

- `npm run lint` délègue au type-check (`tsc --noEmit`) afin de contourner les restrictions d'installation dans cet environnement.
- `npm run check` lance `tsc --noEmit`.
- `npm test` exécute la suite unitaire via le shim maison `test-shim/` (API type Vitest) couvrant les services ETL, features, models et bankroll.
- `npm run test:e2e` exécute le scénario Playwright de bout-en-bout (intake → validation → fixtures → bets → review) via un shim léger embarqué (`playwright-shim/`) pour contourner les restrictions d'installation dans certains environnements.

Le runner Node ne génère pas de couverture automatiquement ; utilisez un outil externe (ex. `c8`) si nécessaire.

## Observabilité, logs & debugging

- Les logs applicatifs sont désormais produits par un logger JSON custom (`server/logging.ts`). Ils sont structurés, contextualisés (span, `fixtureId`) et restent lisibles en développement.
- Le middleware HTTP journalise automatiquement les requêtes `/api` avec la durée et un extrait de la réponse JSON.
- Les traces côté domaine sont accessibles en mémoire via les fonctions `getRecentTraces` / `getFixtureTraces` et exposées par deux endpoints :
  - `GET /api/observability/dashboard` → dernier état des connecteurs ETL, flags de validation, traces récentes.
  - `GET /api/observability/fixtures/:id` → timeline détaillée pour un fixture (bets, prédictions, flags, traces associées).
- Pour investiguer un bug terrain :
  1. Interroger `/api/observability/dashboard` pour identifier les anomalies critiques.
  2. Récupérer les traces ciblées via `/api/observability/fixtures/{fixtureId}`.
  3. Si nécessaire, relancer un connecteur via le scheduler manuel et suivre les logs Pino (filtrer sur `fixtureId`).

## Déploiement

1. Vérifier que la CI est au vert (voir section suivante).
2. Générer le build client + bundle serveur :

   ```bash
   npm run build
   ```

3. Publier l'artifact `dist/` ainsi que `client/dist` (généré par Vite) sur l'environnement cible.
4. Exporter les variables d'environnement ci-dessus sur la plateforme d'hébergement (Replit, GitHub Codespaces, etc.).
5. Lancer `npm run start`. Les routes d'observabilité permettent de monitorer la santé post-déploiement.

## Intégration continue

Un workflow GitHub Actions (`.github/workflows/ci.yml`) installe les dépendances puis enchaîne :

1. `npm run lint`
2. `npm run check`
3. `npm test`
4. `npm run test:e2e`

Il est déclenché sur chaque Pull Request et Push afin de garantir l'intégrité du pipeline (typage, linting, tests unitaires et e2e).

## Ré-entraînement hebdomadaire (weekly_review)

Le scheduler (`server/jobs/scheduler.ts`) exécute les connecteurs déclarés puis lance automatiquement un retraining via `trainAndRegisterModel` chaque lundi à 6h UTC (`weekly_review`). Ce job :

1. Recharge les données match/odds/météo pour disposer de l'historique complet avant la semaine à venir.
2. Entraîne un modèle logit calibré (Platt) avec un holdout temporel (par défaut 25%) puis publie la nouvelle version dans `model_registry` et met à jour les prédictions en base.
3. Ignore silencieusement la phase d'entraînement si moins de 5 matches complétés sont disponibles (log dans la console scheduler).

Pour lancer un retraining manuel (par exemple après un correctif de features), utilisez le script utilitaire :

```bash
# Calibrage Platt sur tout l'historique
npx tsx server/models/run-training.ts

# Exemple avec fenêtre restreinte et gradient boosting
MODEL_NAME=gbdt-review MODEL_ALGO=gbdt MODEL_CALIBRATION=isotonic \
  TRAIN_START=2021-07-01 HOLDOUT_RATIO=0.3 \
  npx tsx server/models/run-training.ts
```

Chaque exécution écrit la version, les hyperparamètres et les métriques de backtest (ROI, Brier, calibration, série ROI mensuelle) dans `model_registry`, puis met à jour/insère les enregistrements `predictions` associés au modèle.

## Contrôles anti-leakage

- Les features sont générées uniquement à partir de matches antérieurs (`kickoff_at` strictement inférieur) et pondérées par récence ; le head-to-head et les métriques de forme excluent toute information future.
- Le split entraînement/backtest est chronologique afin d'éviter tout chevauchement temporel ; la calibration (Platt ou isotonic) est appliquée uniquement sur la portion holdout.
- Les probabilités de draw/away sont pondérées par les cotes implicites en entrée pour conserver un alignement marché vs modèle sans injecter les résultats.
- Les prédictions n'alimentent `predictions` que pour les fixtures à venir (status différent de `completed`), ce qui empêche toute fuite de résultat dans les écrans front ou les jobs aval.
