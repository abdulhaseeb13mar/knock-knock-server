-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logo" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- Add company relation field to CompanyEmail
ALTER TABLE "CompanyEmail" ADD COLUMN "companyId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- Backfill companies from existing company metadata
WITH normalized AS (
    SELECT
        TRIM("companyName") AS name,
        REGEXP_REPLACE(
            REGEXP_REPLACE(LOWER(TRIM("companyName")), '[^a-z0-9]+', '-', 'g'),
            '(^-|-$)',
            '',
            'g'
        ) AS slug,
        "description",
        "logo",
        "tags"
    FROM "CompanyEmail"
    WHERE TRIM(COALESCE("companyName", '')) <> ''
),
rolled AS (
    SELECT
        n.slug,
        MIN(n.name) AS name,
        MIN(n."description") FILTER (WHERE n."description" IS NOT NULL) AS description,
        MIN(n."logo") FILTER (WHERE n."logo" IS NOT NULL) AS logo,
        COALESCE(
            (
                SELECT n2."tags"
                FROM normalized n2
                WHERE n2.slug = n.slug
                AND n2."tags" IS NOT NULL
                LIMIT 1
            ),
            ARRAY[]::TEXT[]
        ) AS tags
    FROM normalized n
    WHERE n.slug <> ''
    GROUP BY slug
)
INSERT INTO "Company" ("id", "slug", "name", "description", "logo", "tags", "createdAt")
SELECT
    'company_' || MD5(slug) AS id,
    slug,
    name,
    description,
    logo,
    tags,
    CURRENT_TIMESTAMP
FROM rolled
ON CONFLICT ("slug") DO NOTHING;

-- Link existing emails to their normalized company record
UPDATE "CompanyEmail" ce
SET "companyId" = c."id"
FROM "Company" c
WHERE c."slug" = REGEXP_REPLACE(
    REGEXP_REPLACE(LOWER(TRIM(ce."companyName")), '[^a-z0-9]+', '-', 'g'),
    '(^-|-$)',
    '',
    'g'
)
AND ce."companyId" IS NULL;

-- CreateIndex
CREATE INDEX "CompanyEmail_companyId_idx" ON "CompanyEmail"("companyId");

-- AddForeignKey
ALTER TABLE "CompanyEmail" ADD CONSTRAINT "CompanyEmail_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop old denormalized metadata columns from CompanyEmail
ALTER TABLE "CompanyEmail"
DROP COLUMN "companyName",
DROP COLUMN "description",
DROP COLUMN "logo",
DROP COLUMN "tags";
