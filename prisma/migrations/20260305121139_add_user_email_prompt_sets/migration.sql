-- CreateTable
CREATE TABLE "EmailPromptSet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailFormat" TEXT NOT NULL,
    "aiPrompt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailPromptSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailPromptSet_userId_idx" ON "EmailPromptSet"("userId");

-- AddForeignKey
ALTER TABLE "EmailPromptSet" ADD CONSTRAINT "EmailPromptSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
