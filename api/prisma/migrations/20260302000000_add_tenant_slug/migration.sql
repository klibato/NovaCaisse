-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "slug" TEXT;

-- Backfill existing rows with a slug derived from the name
UPDATE "Tenant" SET "slug" = LOWER(REPLACE(REPLACE("name", ' ', '-'), '''', '')) WHERE "slug" IS NULL;

-- Make slug non-nullable and unique
ALTER TABLE "Tenant" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");
