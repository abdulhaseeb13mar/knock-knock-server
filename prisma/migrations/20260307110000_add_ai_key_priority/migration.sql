-- Add priority to AiKey
ALTER TABLE "AiKey" ADD COLUMN "priority" INTEGER;

-- Backfill priority for existing keys by insertion order per user
WITH ranked_keys AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "userId"
            ORDER BY "createdAt" ASC, "id" ASC
        ) AS row_num
    FROM "AiKey"
)
UPDATE "AiKey" AS a
SET "priority" = r.row_num
FROM ranked_keys AS r
WHERE a."id" = r."id";

-- Enforce priority presence for all rows
ALTER TABLE "AiKey" ALTER COLUMN "priority" SET NOT NULL;
