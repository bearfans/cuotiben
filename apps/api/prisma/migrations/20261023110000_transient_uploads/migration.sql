-- 上传图片仅用于 AI 识别：标记临时记录，并解除识别结果对图片记录的依赖，
-- 以便识别结束后立即删除图片文件与上传记录，同时保留识别结果。

ALTER TABLE "UploadFile" ADD COLUMN "temporary" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "UploadFile_temporary_createdAt_idx" ON "UploadFile"("temporary", "createdAt");

ALTER TABLE "AiJobImage" DROP CONSTRAINT IF EXISTS "AiJobImage_uploadFileId_fkey";
