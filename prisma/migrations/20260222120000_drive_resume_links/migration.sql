-- Drop legacy resume rows so required Drive fields can be added safely
DELETE FROM "ResumeFile";

-- Add Google Drive metadata for resumes
ALTER TABLE "ResumeFile" ADD COLUMN "sharedUrl" TEXT NOT NULL;
ALTER TABLE "ResumeFile" ADD COLUMN "fileId" TEXT NOT NULL;

-- Remove local path column (deprecated)
ALTER TABLE "ResumeFile" DROP COLUMN "path";
