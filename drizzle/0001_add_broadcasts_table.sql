
-- Drop the existing table if it exists
DROP TABLE IF EXISTS "broadcasts";

-- Create broadcasts table with bigint timestamp (no foreign key constraint)
CREATE TABLE IF NOT EXISTS "broadcasts" (
  "id" varchar(255) PRIMARY KEY,
  "message" text NOT NULL,
  "timestamp" bigint NOT NULL,
  "admin_id" varchar(255) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create index for faster timestamp queries
CREATE INDEX IF NOT EXISTS "broadcasts_timestamp_idx" ON "broadcasts" ("timestamp" DESC);
