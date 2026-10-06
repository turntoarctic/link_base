-- 0002_notifications.sql（P1-9 站内通知，T2.9）：提及/评论触发；已读标记；可重建性由业务触发保证
BEGIN;

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  recipient uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- mention | comment | reply
  type text NOT NULL,
  page_id uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  -- 评论串根 id（评论类通知定位用）
  comment_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  -- 展示摘要（评论正文/所在页标题等，写入时快照）
  excerpt text NOT NULL DEFAULT '',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient, read, created_at DESC);
-- 提及去重：同页同用户未读提及只留一条
CREATE UNIQUE INDEX IF NOT EXISTS uniq_notifications_mention_unread
  ON notifications(workspace_id, page_id, recipient)
  WHERE type = 'mention' AND read = false;

COMMIT;
