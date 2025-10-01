CREATE TABLE IF NOT EXISTS "boxscores" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "fixture_id" uuid NOT NULL REFERENCES "fixtures"("id") ON DELETE CASCADE,
  "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "stats" jsonb,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "boxscores_fixture_idx" ON "boxscores" ("fixture_id");
CREATE INDEX IF NOT EXISTS "boxscores_team_idx" ON "boxscores" ("team_id");
CREATE UNIQUE INDEX IF NOT EXISTS "boxscores_fixture_team_idx" ON "boxscores" ("fixture_id", "team_id");
