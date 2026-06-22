-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "igFollowers" TEXT,
ADD COLUMN     "igHandle" TEXT,
ADD COLUMN     "igPostCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "opportunity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pitch" TEXT,
ADD COLUMN     "weaknesses" TEXT;
