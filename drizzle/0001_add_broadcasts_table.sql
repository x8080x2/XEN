
-- Create broadcasts table
CREATE TABLE IF NOT EXISTS "broadcasts" (
  "id" varchar(255) PRIMARY KEY DEFAULT gen_random_uuid(),
  "message" text NOT NULL,
  "timestamp" integer NOT NULL,
  "admin_id" varchar(255) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create index for faster timestamp queries
CREATE INDEX IF NOT EXISTS "broadcasts_timestamp_idx" ON "broadcasts" ("timestamp" DESC);
