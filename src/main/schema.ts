import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  draftPrompt: text('draft_prompt').notNull().default(''),
  model: text('model').notNull(),
  size: text('size').notNull(),
  quality: text('quality').notNull(),
  n: integer('n').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull()
})

export const generationRuns = sqliteTable('generation_runs', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull(),
  prompt: text('prompt').notNull(),
  model: text('model').notNull(),
  size: text('size'),
  quality: text('quality'),
  n: integer('n').notNull().default(1),
  status: text('status', { enum: ['running', 'succeeded', 'failed'] }).notNull(),
  errorMessage: text('error_message'),
  errorDetails: text('error_details'),
  createdAt: text('created_at').notNull()
})

export const imageHistory = sqliteTable('image_history', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id'),
  runId: text('run_id'),
  prompt: text('prompt').notNull(),
  model: text('model').notNull(),
  size: text('size'),
  quality: text('quality'),
  filePath: text('file_path'),
  status: text('status', { enum: ['succeeded', 'failed'] }).notNull(),
  errorMessage: text('error_message'),
  errorDetails: text('error_details'),
  favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull()
})

export type ConversationRow = typeof conversations.$inferSelect
export type NewConversationRow = typeof conversations.$inferInsert
export type GenerationRunRow = typeof generationRuns.$inferSelect
export type NewGenerationRunRow = typeof generationRuns.$inferInsert
export type ImageHistoryRow = typeof imageHistory.$inferSelect
export type NewImageHistoryRow = typeof imageHistory.$inferInsert
