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

## Démarrer le serveur

```bash
npm install
npm run dev
```

Le serveur Express et le client Vite sont disponibles sur le port défini par la variable `PORT` (5000 par défaut).
