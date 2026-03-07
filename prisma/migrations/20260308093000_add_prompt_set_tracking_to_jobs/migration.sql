-- Track the currently selected prompt set on each email job
ALTER TABLE "EmailJob"
ADD COLUMN "emailPromptSetId" TEXT;

-- Track which prompt set was used for each sent email
ALTER TABLE "SentEmail"
ADD COLUMN "emailPromptSetId" TEXT;

-- CreateIndex
CREATE INDEX "EmailJob_emailPromptSetId_idx" ON "EmailJob"("emailPromptSetId");

-- CreateIndex
CREATE INDEX "SentEmail_emailPromptSetId_idx" ON "SentEmail"("emailPromptSetId");

-- AddForeignKey
ALTER TABLE "EmailJob"
ADD CONSTRAINT "EmailJob_emailPromptSetId_fkey"
FOREIGN KEY ("emailPromptSetId") REFERENCES "EmailPromptSet"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentEmail"
ADD CONSTRAINT "SentEmail_emailPromptSetId_fkey"
FOREIGN KEY ("emailPromptSetId") REFERENCES "EmailPromptSet"("id")
ON DELETE SET NULL ON UPDATE CASCADE;