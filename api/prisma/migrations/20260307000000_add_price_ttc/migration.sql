-- AlterTable: Add priceTtc to Product (nullable first for backfill)
ALTER TABLE "Product" ADD COLUMN "priceTtc" INTEGER;

-- Backfill Product.priceTtc from priceHt + vatRate
UPDATE "Product" SET "priceTtc" = ROUND("priceHt" * (1 + "vatRate" / 100.0));

-- Make priceTtc NOT NULL
ALTER TABLE "Product" ALTER COLUMN "priceTtc" SET NOT NULL;

-- AlterTable: Add priceTtc to Menu (nullable first for backfill)
ALTER TABLE "Menu" ADD COLUMN "priceTtc" INTEGER;

-- Backfill Menu.priceTtc from priceHt + vatRate
UPDATE "Menu" SET "priceTtc" = ROUND("priceHt" * (1 + "vatRate" / 100.0));

-- Make priceTtc NOT NULL
ALTER TABLE "Menu" ALTER COLUMN "priceTtc" SET NOT NULL;

-- AlterTable: Add priceTtc to OptionChoice (default 0)
ALTER TABLE "OptionChoice" ADD COLUMN "priceTtc" INTEGER NOT NULL DEFAULT 0;

-- Backfill OptionChoice.priceTtc from priceHt using parent product's vatRate
UPDATE "OptionChoice" oc
SET "priceTtc" = ROUND(oc."priceHt" * (1 + p."vatRate" / 100.0))
FROM "OptionGroup" og
JOIN "Product" p ON p."id" = og."productId"
WHERE oc."optionGroupId" = og."id"
AND oc."priceHt" > 0;
