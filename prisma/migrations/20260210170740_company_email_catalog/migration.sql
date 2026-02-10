/*
  Warnings:

  - You are about to drop the column `email` on the `Recipient` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,companyEmailId]` on the table `Recipient` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `companyEmailId` to the `Recipient` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Recipient_userId_email_key";

-- AlterTable
ALTER TABLE "Recipient" DROP COLUMN "email",
ADD COLUMN     "companyEmailId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "CompanyEmail" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "description" TEXT,
    "logo" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyEmail_email_key" ON "CompanyEmail"("email");

-- CreateIndex
CREATE INDEX "Recipient_companyEmailId_idx" ON "Recipient"("companyEmailId");

-- CreateIndex
CREATE UNIQUE INDEX "Recipient_userId_companyEmailId_key" ON "Recipient"("userId", "companyEmailId");

-- AddForeignKey
ALTER TABLE "Recipient" ADD CONSTRAINT "Recipient_companyEmailId_fkey" FOREIGN KEY ("companyEmailId") REFERENCES "CompanyEmail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
