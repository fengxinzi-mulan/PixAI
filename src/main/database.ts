import { existsSync, mkdirSync, unlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { DEFAULT_MODEL, ratioToSize } from '@shared/image-options'
import type {
  Conversation,
  ConversationUpdate,
  GenerationRun,
  GenerationRunStatus,
  HistoryListOptions,
  ImageHistoryItem,
  ImageRatio,
  ImageStatus
} from '@shared/types'

type Row = Record<string, unknown>

export class AppDatabase {
  readonly imagesDir: string
  private readonly db: Database.Database

  constructor(userDataDir: string) {
    mkdirSync(userDataDir, { recursive: true })
    this.imagesDir = join(userDataDir, 'images')
    mkdirSync(this.imagesDir, { recursive: true })
    this.db = new Database(join(userDataDir, 'pixai.sqlite'))
    this.db.pragma('journal_mode = WAL')
    this.migrate()
  }

  close(): void {
    this.db.close()
  }

  listConversations(): Conversation[] {
    return this.db.prepare('select * from conversations order by updated_at desc').all().map((row) => this.conversationFromRow(row as Row))
  }

  getConversation(id: string): Conversation | null {
    const row = this.db.prepare('select * from conversations where id = ?').get(id) as Row | undefined
    return row ? this.conversationFromRow(row) : null
  }

  createConversation(): Conversation {
    const now = new Date().toISOString()
    const conversation: Conversation = {
      id: randomUUID(),
      title: '新会话',
      draftPrompt: '',
      model: DEFAULT_MODEL,
      ratio: '1:1',
      quality: 'high',
      n: 1,
      autoSaveHistory: true,
      keepFailureDetails: true,
      createdAt: now,
      updatedAt: now
    }
    this.db
      .prepare(
        `insert into conversations
        (id, title, draft_prompt, model, ratio, quality, n, auto_save_history, keep_failure_details, created_at, updated_at)
        values (@id, @title, @draftPrompt, @model, @ratio, @quality, @n, @autoSaveHistory, @keepFailureDetails, @createdAt, @updatedAt)`
      )
      .run({ ...conversation, autoSaveHistory: 1, keepFailureDetails: 1 })
    return conversation
  }

  updateConversation(id: string, input: ConversationUpdate): Conversation {
    const current = this.getConversation(id)
    if (!current) throw new Error('Conversation not found.')
    const next: Conversation = {
      ...current,
      ...input,
      n: input.n !== undefined ? Math.min(10, Math.max(1, input.n)) : current.n,
      updatedAt: new Date().toISOString()
    }
    this.db
      .prepare(
        `update conversations set
        title = @title,
        draft_prompt = @draftPrompt,
        model = @model,
        ratio = @ratio,
        quality = @quality,
        n = @n,
        auto_save_history = @autoSaveHistory,
        keep_failure_details = @keepFailureDetails,
        updated_at = @updatedAt
        where id = @id`
      )
      .run({ ...next, autoSaveHistory: next.autoSaveHistory ? 1 : 0, keepFailureDetails: next.keepFailureDetails ? 1 : 0 })
    return next
  }

  deleteConversation(id: string): void {
    this.db.prepare('update image_history set conversation_id = null where conversation_id = ?').run(id)
    this.db.prepare('delete from generation_runs where conversation_id = ?').run(id)
    this.db.prepare('delete from conversations where id = ?').run(id)
  }

  insertRun(input: Omit<GenerationRun, 'items'>): GenerationRun {
    this.db
      .prepare(
        `insert into generation_runs
        (id, conversation_id, prompt, model, ratio, size, quality, duration_ms, n, status, error_message, error_details, created_at)
        values (@id, @conversationId, @prompt, @model, @ratio, @size, @quality, @durationMs, @n, @status, @errorMessage, @errorDetails, @createdAt)`
      )
      .run(input)
    return { ...input, items: [] }
  }

  updateRun(id: string, input: Partial<Pick<GenerationRun, 'status' | 'errorMessage' | 'errorDetails' | 'durationMs'>>): GenerationRun {
    const current = this.getRun(id)
    if (!current) throw new Error('Generation run not found.')
    const next = { ...current, ...input }
    this.db
      .prepare('update generation_runs set status = ?, error_message = ?, error_details = ?, duration_ms = ? where id = ?')
      .run(next.status, next.errorMessage, next.errorDetails, next.durationMs, id)
    return this.getRun(id) || next
  }

  getRun(id: string): GenerationRun | null {
    const row = this.db.prepare('select * from generation_runs where id = ?').get(id) as Row | undefined
    return row ? this.runFromRow(row) : null
  }

  listRuns(conversationId: string): GenerationRun[] {
    return this.db
      .prepare('select * from generation_runs where conversation_id = ? order by created_at desc')
      .all(conversationId)
      .map((row) => this.runFromRow(row as Row))
  }

  insertHistory(input: Omit<ImageHistoryItem, 'favorite'> & { favorite?: boolean; globalVisible?: boolean }): ImageHistoryItem {
    const item: ImageHistoryItem = { ...input, favorite: Boolean(input.favorite) }
    this.db
      .prepare(
        `insert into image_history
        (id, conversation_id, run_id, prompt, model, ratio, size, quality, request_index, duration_ms, file_path, status, error_message, error_details, favorite, global_visible, created_at)
        values (@id, @conversationId, @runId, @prompt, @model, @ratio, @size, @quality, @requestIndex, @durationMs, @filePath, @status, @errorMessage, @errorDetails, @favorite, @globalVisible, @createdAt)`
      )
      .run({ ...item, favorite: item.favorite ? 1 : 0, globalVisible: input.globalVisible === false ? 0 : 1 })
    return item
  }

  listHistory(options: HistoryListOptions = {}): ImageHistoryItem[] {
    const where: string[] = ['global_visible = 1']
    const params: Record<string, unknown> = {}
    if (options.query?.trim()) {
      where.push('(prompt like @query or model like @query)')
      params.query = `%${options.query.trim()}%`
    }
    if (options.favoritesOnly) where.push('favorite = 1')
    const order = options.sort === 'oldest' ? 'asc' : 'desc'
    const sql = `select * from image_history ${where.length ? `where ${where.join(' and ')}` : ''} order by created_at ${order}`
    return this.db.prepare(sql).all(params).map((row) => this.historyFromRow(row as Row))
  }

  getHistory(id: string): ImageHistoryItem | null {
    const row = this.db.prepare('select * from image_history where id = ?').get(id) as Row | undefined
    return row ? this.historyFromRow(row) : null
  }

  setFavorite(id: string, favorite: boolean): ImageHistoryItem {
    this.db.prepare('update image_history set favorite = ? where id = ?').run(favorite ? 1 : 0, id)
    const item = this.getHistory(id)
    if (!item) throw new Error('History item not found.')
    return item
  }

  deleteHistory(id: string): void {
    const item = this.getHistory(id)
    if (item?.filePath) this.deleteImageFile(item.filePath)
    this.db.prepare('delete from image_history where id = ?').run(id)
  }

  private migrate(): void {
    this.db.exec(`
      create table if not exists conversations (
        id text primary key,
        title text not null,
        draft_prompt text not null,
        model text not null,
        ratio text not null,
        quality text not null,
        n integer not null,
        auto_save_history integer not null,
        keep_failure_details integer not null,
        created_at text not null,
        updated_at text not null
      );

      create table if not exists generation_runs (
        id text primary key,
        conversation_id text not null,
        prompt text not null,
        model text not null,
        ratio text not null,
        size text,
        quality text not null,
        request_index integer,
        duration_ms integer,
        n integer not null,
        status text not null,
        error_message text,
        error_details text,
        created_at text not null
      );

      create table if not exists image_history (
        id text primary key,
        conversation_id text,
        run_id text,
        prompt text not null,
        model text not null,
        ratio text not null,
        size text,
        quality text not null,
        duration_ms integer,
        file_path text,
        status text not null,
        error_message text,
        error_details text,
        favorite integer not null default 0,
        global_visible integer not null default 1,
        created_at text not null
      );
    `)
    const columns = this.db.prepare('pragma table_info(image_history)').all() as Array<{ name: string }>
    if (!columns.some((column) => column.name === 'global_visible')) {
      this.db.exec('alter table image_history add column global_visible integer not null default 1')
    }
    if (!columns.some((column) => column.name === 'duration_ms')) {
      this.db.exec('alter table image_history add column duration_ms integer')
    }
    if (!columns.some((column) => column.name === 'request_index')) {
      this.db.exec('alter table image_history add column request_index integer')
    }
    const runColumns = this.db.prepare('pragma table_info(generation_runs)').all() as Array<{ name: string }>
    if (!runColumns.some((column) => column.name === 'duration_ms')) {
      this.db.exec('alter table generation_runs add column duration_ms integer')
    }
  }

  private conversationFromRow(row: Row): Conversation {
    return {
      id: String(row.id),
      title: String(row.title),
      draftPrompt: String(row.draft_prompt),
      model: String(row.model),
      ratio: row.ratio as ImageRatio,
      quality: row.quality as Conversation['quality'],
      n: Number(row.n),
      autoSaveHistory: Boolean(row.auto_save_history),
      keepFailureDetails: Boolean(row.keep_failure_details),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at)
    }
  }

  private runFromRow = (row: Row): GenerationRun => ({
    id: String(row.id),
    conversationId: String(row.conversation_id),
    prompt: String(row.prompt),
    model: String(row.model),
    ratio: row.ratio as ImageRatio,
    size: row.size ? String(row.size) : ratioToSize(row.ratio as ImageRatio),
    quality: row.quality as GenerationRun['quality'],
    durationMs: row.duration_ms != null ? Number(row.duration_ms) : null,
    n: Number(row.n),
    status: row.status as GenerationRunStatus,
    errorMessage: row.error_message ? String(row.error_message) : null,
    errorDetails: row.error_details ? String(row.error_details) : null,
    createdAt: String(row.created_at),
    items: this.db
      .prepare('select * from image_history where run_id = ? order by created_at asc')
      .all(String(row.id))
      .map((historyRow) => this.historyFromRow(historyRow as Row))
  })

  private historyFromRow = (row: Row): ImageHistoryItem => ({
    id: String(row.id),
    conversationId: row.conversation_id ? String(row.conversation_id) : null,
    runId: row.run_id ? String(row.run_id) : null,
    prompt: String(row.prompt),
    model: String(row.model),
    ratio: row.ratio as ImageRatio,
    size: row.size ? String(row.size) : null,
    quality: row.quality as ImageHistoryItem['quality'],
    requestIndex: row.request_index != null ? Number(row.request_index) : null,
    durationMs: row.duration_ms != null ? Number(row.duration_ms) : null,
    filePath: row.file_path ? String(row.file_path) : null,
    status: row.status as ImageStatus,
    errorMessage: row.error_message ? String(row.error_message) : null,
    errorDetails: row.error_details ? String(row.error_details) : null,
    favorite: Boolean(row.favorite),
    createdAt: String(row.created_at)
  })

  private deleteImageFile(filePath: string): void {
    const resolved = resolve(filePath)
    const imagesRoot = resolve(this.imagesDir)
    if (resolved.startsWith(imagesRoot) && existsSync(resolved)) unlinkSync(resolved)
  }
}
