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
