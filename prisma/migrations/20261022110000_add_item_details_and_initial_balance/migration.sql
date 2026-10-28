-- Additive migration for the approved initial-inventory import structure.
ALTER TYPE "MovementType" ADD VALUE 'INITIAL_BALANCE';

ALTER TABLE "Item"
    ADD COLUMN "reference" TEXT,
    ADD COLUMN "detail1" TEXT,
    ADD COLUMN "detail2" TEXT;

CREATE INDEX "Item_reference_idx" ON "Item"("reference");
