-- 0001_comments.sql（P1-3 评论，T2.4）：页面级 + 行内（文本引用锚点）+ 回复串 + 解决标记
BEGIN;

CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  page_id uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  author uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  anchor jsonb,
  body text NOT NULL,
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_page ON comments(page_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id) WHERE parent_id IS NOT NULL;

COMMIT;
