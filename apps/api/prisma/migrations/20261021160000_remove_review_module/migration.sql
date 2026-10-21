-- 移除复习模块：删除复习记录、评分枚举及错题上的复习调度字段
DROP INDEX IF EXISTS "WrongQuestion_studentId_nextReviewAt_idx";

ALTER TABLE "WrongQuestion"
  DROP COLUMN IF EXISTS "reviewCount",
  DROP COLUMN IF EXISTS "intervalDays",
  DROP COLUMN IF EXISTS "nextReviewAt",
  DROP COLUMN IF EXISTS "lastReviewedAt";

DROP TABLE IF EXISTS "ReviewLog";
DROP TYPE IF EXISTS "ReviewRating";
