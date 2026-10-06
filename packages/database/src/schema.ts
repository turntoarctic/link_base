/**
 * 数据模型（08 §3，权威定义）。PostgreSQL 唯一数据库，Drizzle ORM。
 * 主键 UUID v7（服务端生成）；时间一律 timestamptz UTC。
 * pages.parent_id / pages.text 是 Y.Doc 的派生缓存（08 §5），服务不直接接受客户端写。
 */
import { sql } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import {
  bigint,
  bigserial,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

/** tsvector 列类型（drizzle 核心未内置） */
const tsvector = customType<{ data: string; driverData: string }>({
  dataType: () => 'tsvector',
})

/* ------------------------------- users（08 §3.1） ------------------------------- */

export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  /** 语言偏好（13 §3）：'zh-CN' | 'en'，null=未设置 */
  locale: text('locale'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  /** 软删（登录拒绝） */
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

/* --------------------------- workspaces / members（08 §3.2） --------------------------- */

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // check (role in ('owner','admin','member'))
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.userId] }),
    // 我的空间列表（08 §3.2）
    index('idx_members_user').on(t.userId),
  ],
)

/* ------------------------------ pages（08 §3.3） ------------------------------ */

export const pages = pgTable(
  'pages',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    /** 标题唯一真相，客户端 PATCH 直写（05 §5） */
    title: text('title').notNull().default(''),
    /** emoji 或图片 url */
    icon: text('icon'),
    /** 语义是回收站不是删除（08 §1） */
    isTrash: boolean('is_trash').notNull().default(false),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    isTemplate: boolean('is_template').notNull().default(false),
    /** 派生缓存：子页面块推导，顶级为 NULL（08 §5） */
    parentId: uuid('parent_id'),
    /** 派生缓存：正文纯文本（搜索用） */
    text: text('text').notNull().default(''),
    searchTsv: tsvector('search_tsv').generatedAlwaysAs(
      sql`to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(text, ''))`,
    ),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** 最后收到 update 的时间 */
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_pages_ws').on(t.workspaceId).where(sql`not is_trash`),
    index('idx_pages_parent').on(t.parentId).where(sql`parent_id is not null`),
    index('idx_pages_search').using('gin', t.searchTsv),
    index('idx_pages_trgm').using(
      'gin',
      sql`${t.title} gin_trgm_ops`,
      sql`${t.text} gin_trgm_ops`,
    ),
  ],
)

/* --------------------- page_updates / page_snapshots（08 §3.4） --------------------- */

export const pageUpdates = pgTable(
  'page_updates',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    pageId: uuid('page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    /** 单条 Yjs update（二进制） */
    blob: customType<{ data: Uint8Array; driverData: Uint8Array }>({
      dataType: () => 'bytea',
    })('blob').notNull(),
    actor: uuid('actor')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_updates_page').on(t.pageId, t.id)],
)

export const pageSnapshots = pgTable(
  'page_snapshots',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    pageId: uuid('page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    /** 每页自增，不回收 */
    version: integer('version').notNull(),
    /** 合并后的 Y.Doc 全量状态（state update 形态） */
    blob: customType<{ data: Uint8Array; driverData: Uint8Array }>({
      dataType: () => 'bytea',
    })('blob').notNull(),
    reason: text('reason').notNull().default('auto'), // auto | manual | restore | copy
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('page_snapshots_page_version_key').on(t.pageId, t.version)],
)

/* ------------------------------- 其余表（08 §3.5） ------------------------------- */

export const blobs = pgTable('blobs', {
  /** 内容寻址（sha256 前 32 位 hex） */
  id: text('id').primaryKey(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  /** MVP 库内存储；对象存储接入后此列外移（08 §7） */
  data: customType<{ data: Uint8Array; driverData: Uint8Array }>({
    dataType: () => 'bytea',
  })('data').notNull(),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** 1–8，对应 06 §5.1 色板 */
    color: smallint('color').notNull().default(6),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('tags_ws_name_key').on(t.workspaceId, t.name)],
)

export const pageTags = pgTable(
  'page_tags',
  {
    pageId: uuid('page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.pageId, t.tagId] }),
    index('idx_page_tags_tag').on(t.tagId),
  ],
)

export const favorites = pgTable(
  'favorites',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    pageId: uuid('page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.pageId] })],
)

/** P1 建表即可，功能后开（08 §3.5）；upsert 刷新 visited_at */
export const pageVisits = pgTable(
  'page_visits',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    pageId: uuid('page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    visitedAt: timestamp('visited_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.pageId] })],
)

/* ------------------------------- 行类型推导 ------------------------------- */

export type UserRow = typeof users.$inferSelect
export type WorkspaceRow = typeof workspaces.$inferSelect
export type WorkspaceMemberRow = typeof workspaceMembers.$inferSelect
export type PageRow = typeof pages.$inferSelect
export type PageUpdateRow = typeof pageUpdates.$inferSelect
export type PageSnapshotRow = typeof pageSnapshots.$inferSelect
export type BlobRow = typeof blobs.$inferSelect
export type TagRow = typeof tags.$inferSelect

/** 角色约束与快照 reason 约束（与 0000_init.sql 的 check 一致） */
export const ROLES = ['owner', 'admin', 'member'] as const
export const SNAPSHOT_REASONS = ['auto', 'manual', 'restore', 'copy'] as const

/* ------------------------------- comments（P1-3 评论，T2.4） ------------------------------- */

/** 行内评论锚点：文本引用（quote + 前后文），随内容编辑仍可定位 */
export interface CommentAnchor {
  quote: string
  prefix: string
  suffix: string
}

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    pageId: uuid('page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    /** 回复串：null = 顶级评论（页面级或行内） */
    parentId: uuid('parent_id').references((): AnyPgColumn => comments.id, { onDelete: 'cascade' }),
    author: uuid('author')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** null = 页面级评论 */
    anchor: jsonb('anchor').$type<CommentAnchor | null>(),
    body: text('body').notNull(),
    resolved: boolean('resolved').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_comments_page').on(t.pageId, t.createdAt),
    index('idx_comments_parent').on(t.parentId),
  ],
)

export type CommentRow = typeof comments.$inferSelect

/* ------------------------------- notifications（P1-9 站内通知，T2.9） ------------------------------- */

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    recipient: uuid('recipient')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    actor: uuid('actor')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** mention | comment | reply */
    type: text('type').notNull(),
    pageId: uuid('page_id')
      .notNull()
      .references(() => pages.id, { onDelete: 'cascade' }),
    commentId: uuid('comment_id').references((): AnyPgColumn => comments.id, { onDelete: 'cascade' }),
    excerpt: text('excerpt').notNull().default(''),
    read: boolean('read').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_notifications_recipient').on(t.recipient, t.read, t.createdAt)],
)

export type NotificationRow = typeof notifications.$inferSelect
