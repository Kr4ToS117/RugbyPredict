CREATE TABLE "etl_job_runs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "job_name" text NOT NULL,
        "connector_name" text NOT NULL,
        "status" varchar(16) NOT NULL,
        "started_at" timestamp with time zone DEFAULT now() NOT NULL,
        "finished_at" timestamp with time zone,
        "duration_ms" integer,
        "records_processed" integer,
        "success_rate" numeric(5, 2),
        "issues" integer,
        "metadata" jsonb,
        "error" text,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "etl_job_runs_job_idx" ON "etl_job_runs" USING btree ("job_name");
--> statement-breakpoint
CREATE INDEX "etl_job_runs_connector_idx" ON "etl_job_runs" USING btree ("connector_name");
--> statement-breakpoint
CREATE INDEX "etl_job_runs_started_idx" ON "etl_job_runs" USING btree ("started_at");
--> statement-breakpoint
ALTER TABLE "validation_flags" ALTER COLUMN "prediction_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "validation_flags" ADD COLUMN "source" text;
--> statement-breakpoint
ALTER TABLE "validation_flags" ADD COLUMN "details" jsonb;
