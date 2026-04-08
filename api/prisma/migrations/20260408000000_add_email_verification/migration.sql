-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN "emailVerificationToken" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "emailVerificationExpires" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_emailVerificationToken_key" ON "Tenant"("emailVerificationToken");
