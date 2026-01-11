import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

export const capturedFiles = pgTable("captured_files", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: text("session_id").notNull(),
  fileSet: text("file_set").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  idbKey: text("idb_key").notNull(), // IndexedDBのキー (Local S3 reference)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
})

export type CapturedFile = typeof capturedFiles.$inferSelect
export type NewCapturedFile = typeof capturedFiles.$inferInsert
