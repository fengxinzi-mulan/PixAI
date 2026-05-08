import { app } from 'electron'
import { mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { and, asc, desc, eq, like, type SQL } from 'drizzle-orm'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import {
  conversations,
  generationRuns,
  imageHistory,
  type ConversationRow,
  type GenerationRunRow,
  type ImageHistoryRow,
  type NewConversationRow,
  type NewGenerationRunRow,
  type NewImageHistoryRow
} from './schema'
import type { Conversation, ConversationUpdate, GenerationRun, HistoryListOptions, ImageHistoryItem } from '../shared/types'

export class AppDatabase {
  private readonly sqlite: Database.Database
  private readonly db: BetterSQLite3Database
  readonly dataDir: string
  readonly imagesDir: string

  constructor() {
    this.dataDir = app.getPath('userData')
    this.imagesDir = join(this.dataDir, 'images')
    mkdirSync(this.imagesDir, { recursive: true })

    const dbPath = join(this.dataDir, 'pixai.sqlite')
    mkdirSync(dirname(dbPath), { recursive: true })
    this.sqlite = new Database(dbPath)
    this.sqlite.pragma('journal_mode = WAL')
    this.db = drizzle(this.sqlite)
    this.migrate()
  }

  close(): void {
    this.sqlite.close()
  }

  insertHistory(row: NewImageHistoryRow): ImageHistoryItem {
    this.db.insert(imageHistory).values(row).run()
    return this.toItem(row as ImageHistoryRow)
  }

  listConversations(): Conversation[] {
    return this.db
      .select()
      .from(conversations)
      .orderBy(desc(conversations.updatedAt))
      .all()
      .map((row) => this.toConversation(row))
  }

  createConversation(input: Omit<NewConversationRow, 'createdAt' | 'updatedAt'> & Partial<Pick<NewConversationRow, 'createdAt' | 'updatedAt'>>): Conversation {
    const now = new Date().toISOString()
    const row: NewConversationRow = {
      ...input,
      createdAt: input.createdAt || now,
      updatedAt: input.updatedAt || now
    }
    this.db.insert(conversations).values(row).run()
    return this.toConversation(row as ConversationRow)
  }

  updateConversation(id: string, input: ConversationUpdate): Conversation {
    const next = {
      ...input,
      updatedAt: new Date().toISOString()
    }
    this.db.update(conversations).set(next).where(eq(conversations.id, id)).run()
    const row = this.db.select().from(conversations).where(eq(conversations.id, id)).get()
    if (!row) {
      throw new Error('Conversation not found')
    }
    return this.toConversation(row)
  }

  deleteConversation(id: string): void {
    this.db.delete(conversations).where(eq(conversations.id, id)).run()
    this.db.delete(generationRuns).where(eq(generationRuns.conversationId, id)).run()
    this.db
      .update(imageHistory)
      .set({ conversationId: null, runId: null })
      .where(eq(imageHistory.conversationId, id))
      .run()
  }

  insertRun(row: NewGenerationRunRow): GenerationRun {
    this.db.insert(generationRuns).values(row).run()
    return this.getRun(row.id) ?? this.toRun(row as GenerationRunRow, [])
  }

  updateRun(id: string, input: Partial<Pick<GenerationRunRow, 'status' | 'errorMessage' | 'errorDetails'>>): GenerationRun {
    this.db.update(generationRuns).set(input).where(eq(generationRuns.id, id)).run()
    const run = this.getRun(id)
    if (!run) {
      throw new Error('Generation run not found')
    }
    return run
  }

  getRun(id: string): GenerationRun | null {
    const row = this.db.select().from(generationRuns).where(eq(generationRuns.id, id)).get()
    if (!row) {
      return null
    }
    const items = this.db
      .select()
      .from(imageHistory)
      .where(eq(imageHistory.runId, id))
      .orderBy(asc(imageHistory.createdAt))
      .all()
      .map((item) => this.toItem(item))
    return this.toRun(row, items)
  }

  listRuns(conversationId: string): GenerationRun[] {
    const rows = this.db
      .select()
      .from(generationRuns)
      .where(eq(generationRuns.conversationId, conversationId))
      .orderBy(asc(generationRuns.createdAt))
      .all()
    return rows.map((row) => {
      const items = this.db
        .select()
        .from(imageHistory)
        .where(eq(imageHistory.runId, row.id))
        .orderBy(asc(imageHistory.createdAt))
        .all()
        .map((item) => this.toItem(item))
      return this.toRun(row, items)
    })
  }

  listHistory(options: HistoryListOptions = {}): ImageHistoryItem[] {
    const conditions: SQL[] = []
    const query = options.query?.trim()
    if (query) {
      conditions.push(like(imageHistory.prompt, `%${query}%`))
    }
    if (options.favoritesOnly) {
      conditions.push(eq(imageHistory.favorite, true))
    }

    const orderBy = options.sort === 'oldest' ? asc(imageHistory.createdAt) : desc(imageHistory.createdAt)
    const rows =
      conditions.length > 0
        ? this.db.select().from(imageHistory).where(and(...conditions)).orderBy(orderBy).all()
        : this.db.select().from(imageHistory).orderBy(orderBy).all()

    return rows.map((row) => this.toItem(row))
  }

  getHistory(id: string): ImageHistoryItem | null {
    const row = this.db.select().from(imageHistory).where(eq(imageHistory.id, id)).get()
    return row ? this.toItem(row) : null
  }

  setFavorite(id: string, favorite: boolean): ImageHistoryItem {
    this.db.update(imageHistory).set({ favorite }).where(eq(imageHistory.id, id)).run()
    const updated = this.getHistory(id)
    if (!updated) {
      throw new Error('History item not found')
    }
    return updated
  }

  deleteHistory(id: string): void {
    const item = this.getHistory(id)
    if (!item) {
      return
    }

    if (item.filePath) {
      const filePath = resolve(item.filePath)
      const imagesDir = resolve(this.imagesDir)
      if (filePath.startsWith(imagesDir)) {
        rmSync(filePath, { force: true })
      }
    }

    this.db.delete(imageHistory).where(eq(imageHistory.id, id)).run()
  }

  private toItem(row: ImageHistoryRow): ImageHistoryItem {
    return {
      id: row.id,
      conversationId: row.conversationId,
      runId: row.runId,
      prompt: row.prompt,
      model: row.model,
      size: row.size,
      quality: row.quality,
      filePath: row.filePath,
      status: row.status,
      errorMessage: row.errorMessage,
      errorDetails: row.errorDetails,
      favorite: Boolean(row.favorite),
      createdAt: row.createdAt
    }
  }

  private migrate(): void {
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        draft_prompt TEXT NOT NULL DEFAULT '',
        model TEXT NOT NULL,
        size TEXT NOT NULL,
        quality TEXT NOT NULL,
        n INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS conversations_updated_at_idx ON conversations(updated_at);

      CREATE TABLE IF NOT EXISTS generation_runs (
        id TEXT PRIMARY KEY NOT NULL,
        conversation_id TEXT NOT NULL,
        prompt TEXT NOT NULL,
        model TEXT NOT NULL,
        size TEXT,
        quality TEXT,
        n INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL,
        error_message TEXT,
        error_details TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS generation_runs_conversation_id_idx ON generation_runs(conversation_id);
      CREATE INDEX IF NOT EXISTS generation_runs_created_at_idx ON generation_runs(created_at);

      CREATE TABLE IF NOT EXISTS image_history (
        id TEXT PRIMARY KEY NOT NULL,
        conversation_id TEXT,
        run_id TEXT,
        prompt TEXT NOT NULL,
        model TEXT NOT NULL,
        size TEXT,
        quality TEXT,
        file_path TEXT,
        status TEXT NOT NULL,
        error_message TEXT,
        error_details TEXT,
        favorite INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS image_history_created_at_idx ON image_history(created_at);
      CREATE INDEX IF NOT EXISTS image_history_prompt_idx ON image_history(prompt);
    `)

    this.addColumnIfMissing('image_history', 'conversation_id', 'TEXT')
    this.addColumnIfMissing('image_history', 'run_id', 'TEXT')
    this.addColumnIfMissing('image_history', 'error_details', 'TEXT')
    this.addColumnIfMissing('generation_runs', 'error_details', 'TEXT')
    this.sqlite.exec(`
      CREATE INDEX IF NOT EXISTS image_history_conversation_id_idx ON image_history(conversation_id);
      CREATE INDEX IF NOT EXISTS image_history_run_id_idx ON image_history(run_id);
    `)
  }

  private addColumnIfMissing(table: string, column: string, definition: string): void {
    const columns = this.sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
    if (!columns.some((item) => item.name === column)) {
      this.sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
    }
  }

  private toConversation(row: ConversationRow): Conversation {
    return {
      id: row.id,
      title: row.title,
      draftPrompt: row.draftPrompt,
      model: row.model,
      size: row.size,
      quality: row.quality,
      n: row.n,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }
  }

  private toRun(row: GenerationRunRow, items: ImageHistoryItem[]): GenerationRun {
    return {
      id: row.id,
      conversationId: row.conversationId,
      prompt: row.prompt,
      model: row.model,
      size: row.size,
      quality: row.quality,
      n: row.n,
      status: row.status,
      errorMessage: row.errorMessage,
      errorDetails: row.errorDetails,
      createdAt: row.createdAt,
      items
    }
  }
}
