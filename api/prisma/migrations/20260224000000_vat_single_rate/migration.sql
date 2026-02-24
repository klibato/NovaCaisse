-- Migration: Replace dual VAT rates (vatRateOnsite/vatRateTakeaway) with single vatRate
-- Reason: French VAT depends on product packaging, not consumption location

-- Product: copy vatRateOnsite to vatRate, then drop both old columns
ALTER TABLE "Product" ADD COLUMN "vatRate" DECIMAL(65,30) NOT NULL DEFAULT 10.0;
UPDATE "Product" SET "vatRate" = "vatRateOnsite";
ALTER TABLE "Product" DROP COLUMN "vatRateOnsite";
ALTER TABLE "Product" DROP COLUMN "vatRateTakeaway";

-- Menu: copy vatRateOnsite to vatRate, then drop both old columns
ALTER TABLE "Menu" ADD COLUMN "vatRate" DECIMAL(65,30) NOT NULL DEFAULT 10.0;
UPDATE "Menu" SET "vatRate" = "vatRateOnsite";
ALTER TABLE "Menu" DROP COLUMN "vatRateOnsite";
ALTER TABLE "Menu" DROP COLUMN "vatRateTakeaway";
