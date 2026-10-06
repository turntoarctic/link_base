-- 0003_share.sql（Phase 3 公开分享）：页面只读分享开关 + slug（能力 URL）
BEGIN;

ALTER TABLE pages
  ADD COLUMN IF NOT EXISTS share_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_slug text;

-- slug 唯一（分享 URL 寻址键）
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pages_share_slug
  ON pages(share_slug) WHERE share_slug IS NOT NULL;

COMMIT;
