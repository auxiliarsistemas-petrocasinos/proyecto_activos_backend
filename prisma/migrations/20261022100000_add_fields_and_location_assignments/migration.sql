-- CreateTable
CREATE TABLE "Field" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Field_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Location" ADD COLUMN "fieldId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Field_name_key" ON "Field"("name");
CREATE INDEX "Location_fieldId_idx" ON "Location"("fieldId");

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "Field"("id") ON DELETE SET NULL ON UPDATE CASCADE;
