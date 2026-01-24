import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: text("session_id").notNull(),
  fileSet: text("file_set").notNull(),
  category: text("category"), // 'camera', 'microphone', etc.
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  idbKey: text("idb_key").notNull(), // IndexedDBのキー (Local S3 reference)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
})

export type ToolFileRecord = typeof files.$inferSelect
export type NewToolFileRecord = typeof files.$inferInsert
