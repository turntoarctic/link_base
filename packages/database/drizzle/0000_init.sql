-- 0000_init.sql — 初始基线迁移（08 全表，手写基线；后续变更用 drizzle-kit generate 增量）
BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name          text NOT NULL,
  avatar_url    text,
  locale        text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  deleted_at    timestamptz
);

CREATE TABLE IF NOT EXISTS workspaces (
  id         uuid PRIMARY KEY,
  name       text NOT NULL,
  avatar_url text,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         text NOT NULL CHECK (role IN ('owner','admin','member')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_members_user ON workspace_members(user_id);

CREATE TABLE IF NOT EXISTS pages (
  id           uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title        text NOT NULL DEFAULT '',
  icon         text,
  is_trash     boolean NOT NULL DEFAULT false,
  deleted_at   timestamptz,
  is_template  boolean NOT NULL DEFAULT false,
  parent_id    uuid,
  text         text NOT NULL DEFAULT '',
  search_tsv   tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(text,''))) STORED,
  created_by   uuid NOT NULL REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pages_ws ON pages(workspace_id) WHERE NOT is_trash;
CREATE INDEX IF NOT EXISTS idx_pages_parent ON pages(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pages_search ON pages USING gin(search_tsv);
CREATE INDEX IF NOT EXISTS idx_pages_trgm ON pages USING gin (title gin_trgm_ops, text gin_trgm_ops);

CREATE TABLE IF NOT EXISTS page_updates (
  id         bigserial PRIMARY KEY,
  page_id    uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  blob       bytea NOT NULL,
  actor      uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_updates_page ON page_updates(page_id, id);

CREATE TABLE IF NOT EXISTS page_snapshots (
  id         bigserial PRIMARY KEY,
  page_id    uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  version    integer NOT NULL,
  blob       bytea NOT NULL,
  reason     text NOT NULL DEFAULT 'auto' CHECK (reason IN ('auto','manual','restore','copy')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_id, version)
);

CREATE TABLE IF NOT EXISTS blobs (
  id           text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  mime         text NOT NULL,
  size         integer NOT NULL,
  data         bytea NOT NULL,
  created_by   uuid NOT NULL REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tags (
  id           uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         text NOT NULL,
  color        smallint NOT NULL DEFAULT 6 CHECK (color BETWEEN 1 AND 8),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, name)
);

CREATE TABLE IF NOT EXISTS page_tags (
  page_id uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  tag_id  uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (page_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_page_tags_tag ON page_tags(tag_id);

CREATE TABLE IF NOT EXISTS favorites (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page_id    uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, page_id)
);

CREATE TABLE IF NOT EXISTS page_visits (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page_id    uuid NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  visited_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, page_id)
);

COMMIT;
