-- 0004_page_refs.sql（Phase 3 反向链接）：页面引用表，derive 管道维护（08 §5 的 P2 兑现）
BEGIN;

CREATE TABLE IF NOT EXISTS page_refs (
  source_page_id uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  target_page_id uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  PRIMARY KEY (source_page_id, target_page_id)
);

CREATE INDEX IF NOT EXISTS idx_page_refs_target ON page_refs(target_page_id);

COMMIT;
