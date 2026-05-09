import { copyFileSync, existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'
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
  ImageStatus,
  ReferenceImage
} from '@shared/types'

type Row = Record<string, unknown>

export const MAX_REFERENCE_IMAGES = 8
export const MAX_REFERENCE_IMAGE_BYTES = 20 * 1024 * 1024

const referenceMimeTypes = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
  ['image/webp', '.webp']
])

export class AppDatabase {
  readonly imagesDir: string
  readonly referenceImagesDir: string
  private readonly db: Database.Database

  constructor(userDataDir: string) {
    mkdirSync(userDataDir, { recursive: true })
    this.imagesDir = join(userDataDir, 'images')
    this.referenceImagesDir = join(userDataDir, 'reference-images')
    mkdirSync(this.imagesDir, { recursive: true })
    mkdirSync(this.referenceImagesDir, { recursive: true })
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
      referenceImages: [],
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

  insertRun(input: Omit<GenerationRun, 'items' | 'referenceImages'> & { referenceImages?: ReferenceImage[] }): GenerationRun {
    this.db
      .prepare(
        `insert into generation_runs
        (id, conversation_id, prompt, model, ratio, size, quality, duration_ms, n, status, error_message, error_details, generation_mode, created_at)
        values (@id, @conversationId, @prompt, @model, @ratio, @size, @quality, @durationMs, @n, @status, @errorMessage, @errorDetails, @generationMode, @createdAt)`
      )
      .run({ ...input, generationMode: input.generationMode || 'text-to-image' })
    return { ...input, referenceImages: input.referenceImages || [], items: [] }
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

  insertHistory(input: Omit<ImageHistoryItem, 'favorite' | 'referenceImages'> & {
    favorite?: boolean
    globalVisible?: boolean
    referenceImages?: ReferenceImage[]
  }): ImageHistoryItem {
    const item: ImageHistoryItem = { ...input, favorite: Boolean(input.favorite), referenceImages: input.referenceImages || [] }
    this.db
      .prepare(
        `insert into image_history
        (id, conversation_id, run_id, prompt, model, ratio, size, quality, request_index, duration_ms, file_path, file_size_bytes, status, error_message, error_details, favorite, global_visible, generation_mode, created_at)
        values (@id, @conversationId, @runId, @prompt, @model, @ratio, @size, @quality, @requestIndex, @durationMs, @filePath, @fileSizeBytes, @status, @errorMessage, @errorDetails, @favorite, @globalVisible, @generationMode, @createdAt)`
      )
      .run({ ...item, favorite: item.favorite ? 1 : 0, globalVisible: input.globalVisible === false ? 0 : 1, generationMode: input.generationMode || 'text-to-image' })
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

  getReferenceImage(id: string): ReferenceImage | null {
    const row = this.db.prepare('select * from reference_images where id = ?').get(id) as Row | undefined
    return row ? this.referenceFromRow(row) : null
  }

  listConversationReferences(conversationId: string): ReferenceImage[] {
    return this.db
      .prepare(`
        select reference_images.* from conversation_reference_images
        join reference_images on reference_images.id = conversation_reference_images.reference_image_id
        where conversation_reference_images.conversation_id = ?
        order by conversation_reference_images.position asc, conversation_reference_images.created_at asc
      `)
      .all(conversationId)
      .map((row) => this.referenceFromRow(row as Row))
  }

  createReferenceImageFromBytes(input: {
    conversationId: string
    name: string
    mimeType: string
    data: ArrayBuffer | Uint8Array
  }): ReferenceImage {
    const current = this.listConversationReferences(input.conversationId)
    if (current.length >= MAX_REFERENCE_IMAGES) {
      throw new Error(`最多只能添加 ${MAX_REFERENCE_IMAGES} 张参考图。`)
    }

    const mimeType = normalizeReferenceMimeType(input.mimeType, input.name)
    const buffer = Buffer.from(input.data instanceof Uint8Array ? input.data : new Uint8Array(input.data))
    if (buffer.length > MAX_REFERENCE_IMAGE_BYTES) {
      throw new Error('单张参考图不能超过 20MB。')
    }

    const now = new Date().toISOString()
    const id = randomUUID()
    const extension = referenceMimeTypes.get(mimeType) || extensionFromName(input.name) || '.png'
    const filePath = join(this.referenceImagesDir, `${id}${extension}`)
    writeFileSync(filePath, buffer)
    const reference = this.insertReferenceImage({
      id,
      name: input.name || `reference-${current.length + 1}${extension}`,
      mimeType,
      filePath,
      fileSizeBytes: buffer.length,
      createdAt: now
    })
    this.attachReferenceToConversation(input.conversationId, reference.id, current.length)
    return reference
  }

  addHistoryImageAsReference(conversationId: string, historyId: string): ReferenceImage {
    const current = this.listConversationReferences(conversationId)
    if (current.length >= MAX_REFERENCE_IMAGES) {
      throw new Error(`最多只能添加 ${MAX_REFERENCE_IMAGES} 张参考图。`)
    }
    const item = this.getHistory(historyId)
    if (!item?.filePath || !existsSync(item.filePath)) {
      throw new Error('Image file not found.')
    }

    const now = new Date().toISOString()
    const id = randomUUID()
    const extension = extname(item.filePath) || '.png'
    const filePath = join(this.referenceImagesDir, `${id}${extension}`)
    copyFileSync(item.filePath, filePath)
    const fileSizeBytes = this.getImageFileSize(filePath) || 0
    const reference = this.insertReferenceImage({
      id,
      name: basename(item.filePath),
      mimeType: mimeTypeFromExtension(extension),
      filePath,
      fileSizeBytes,
      createdAt: now
    })
    this.attachReferenceToConversation(conversationId, reference.id, current.length)
    return reference
  }

  removeReferenceFromConversation(conversationId: string, referenceImageId: string): ReferenceImage[] {
    this.db
      .prepare('delete from conversation_reference_images where conversation_id = ? and reference_image_id = ?')
      .run(conversationId, referenceImageId)
    return this.compactConversationReferencePositions(conversationId)
  }

  reorderConversationReferences(conversationId: string, referenceImageIds: string[]): ReferenceImage[] {
    const currentIds = new Set(this.listConversationReferences(conversationId).map((reference) => reference.id))
    const orderedIds = referenceImageIds.filter((id) => currentIds.has(id))
    const missingIds = Array.from(currentIds).filter((id) => !orderedIds.includes(id))
    const nextIds = [...orderedIds, ...missingIds].slice(0, MAX_REFERENCE_IMAGES)
    const updatePosition = this.db.prepare(
      'update conversation_reference_images set position = ? where conversation_id = ? and reference_image_id = ?'
    )
    const transaction = this.db.transaction(() => {
      nextIds.forEach((id, index) => updatePosition.run(index, conversationId, id))
    })
    transaction()
    return this.listConversationReferences(conversationId)
  }

  insertRunReferences(runId: string, references: ReferenceImage[]): void {
    const insert = this.db.prepare(`
      insert into generation_run_references
      (run_id, reference_image_id, position, name, mime_type, file_path, file_size_bytes, created_at)
      values (@runId, @referenceImageId, @position, @name, @mimeType, @filePath, @fileSizeBytes, @createdAt)
    `)
    const transaction = this.db.transaction(() => {
      references.forEach((reference, position) => {
        insert.run({
          runId,
          referenceImageId: reference.id,
          position,
          name: reference.name,
          mimeType: reference.mimeType,
          filePath: reference.filePath,
          fileSizeBytes: reference.fileSizeBytes,
          createdAt: reference.createdAt
        })
      })
    })
    transaction()
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
        generation_mode text not null default 'text-to-image',
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
        file_size_bytes integer,
        status text not null,
        error_message text,
        error_details text,
        favorite integer not null default 0,
        global_visible integer not null default 1,
        generation_mode text not null default 'text-to-image',
        created_at text not null
      );

      create table if not exists reference_images (
        id text primary key,
        name text not null,
        mime_type text not null,
        file_path text not null,
        file_size_bytes integer not null,
        created_at text not null
      );

      create table if not exists conversation_reference_images (
        conversation_id text not null,
        reference_image_id text not null,
        position integer not null,
        created_at text not null,
        primary key (conversation_id, reference_image_id)
      );

      create table if not exists generation_run_references (
        run_id text not null,
        reference_image_id text not null,
        position integer not null,
        name text not null,
        mime_type text not null,
        file_path text,
        file_size_bytes integer not null,
        created_at text not null,
        primary key (run_id, reference_image_id)
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
    if (!columns.some((column) => column.name === 'file_size_bytes')) {
      this.db.exec('alter table image_history add column file_size_bytes integer')
    }
    if (!columns.some((column) => column.name === 'generation_mode')) {
      this.db.exec("alter table image_history add column generation_mode text not null default 'text-to-image'")
    }
    const runColumns = this.db.prepare('pragma table_info(generation_runs)').all() as Array<{ name: string }>
    if (!runColumns.some((column) => column.name === 'duration_ms')) {
      this.db.exec('alter table generation_runs add column duration_ms integer')
    }
    if (!runColumns.some((column) => column.name === 'generation_mode')) {
      this.db.exec("alter table generation_runs add column generation_mode text not null default 'text-to-image'")
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
      referenceImages: this.listConversationReferences(String(row.id)),
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
    generationMode: row.generation_mode === 'image-to-image' ? 'image-to-image' : 'text-to-image',
    referenceImages: this.listRunReferences(String(row.id)),
    createdAt: String(row.created_at),
    items: this.db
      .prepare(`
        select * from image_history
        where run_id = ?
        order by
          case when request_index is null then 1 else 0 end,
          request_index asc,
          created_at asc
      `)
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
    fileSizeBytes: row.file_size_bytes != null ? Number(row.file_size_bytes) : this.getImageFileSize(row.file_path),
    status: row.status as ImageStatus,
    errorMessage: row.error_message ? String(row.error_message) : null,
    errorDetails: row.error_details ? String(row.error_details) : null,
    favorite: Boolean(row.favorite),
    generationMode: row.generation_mode === 'image-to-image' ? 'image-to-image' : 'text-to-image',
    referenceImages: row.run_id ? this.listRunReferences(String(row.run_id)) : [],
    createdAt: String(row.created_at)
  })

  private insertReferenceImage(reference: ReferenceImage): ReferenceImage {
    this.db
      .prepare(
        `insert into reference_images
        (id, name, mime_type, file_path, file_size_bytes, created_at)
        values (@id, @name, @mimeType, @filePath, @fileSizeBytes, @createdAt)`
      )
      .run(reference)
    return reference
  }

  private attachReferenceToConversation(conversationId: string, referenceImageId: string, position: number): void {
    this.db
      .prepare(
        `insert or ignore into conversation_reference_images
        (conversation_id, reference_image_id, position, created_at)
        values (?, ?, ?, ?)`
      )
      .run(conversationId, referenceImageId, position, new Date().toISOString())
  }

  private compactConversationReferencePositions(conversationId: string): ReferenceImage[] {
    const references = this.listConversationReferences(conversationId)
    const updatePosition = this.db.prepare(
      'update conversation_reference_images set position = ? where conversation_id = ? and reference_image_id = ?'
    )
    const transaction = this.db.transaction(() => {
      references.forEach((reference, index) => updatePosition.run(index, conversationId, reference.id))
    })
    transaction()
    return this.listConversationReferences(conversationId)
  }

  private listRunReferences(runId: string): ReferenceImage[] {
    return this.db
      .prepare('select * from generation_run_references where run_id = ? order by position asc, created_at asc')
      .all(runId)
      .map((row) => this.runReferenceFromRow(row as Row))
  }

  private referenceFromRow(row: Row): ReferenceImage {
    return {
      id: String(row.id),
      name: String(row.name),
      mimeType: String(row.mime_type),
      filePath: row.file_path ? String(row.file_path) : null,
      fileSizeBytes: Number(row.file_size_bytes),
      createdAt: String(row.created_at)
    }
  }

  private runReferenceFromRow(row: Row): ReferenceImage {
    return {
      id: String(row.reference_image_id),
      name: String(row.name),
      mimeType: String(row.mime_type),
      filePath: row.file_path ? String(row.file_path) : null,
      fileSizeBytes: Number(row.file_size_bytes),
      createdAt: String(row.created_at)
    }
  }

  private deleteImageFile(filePath: string): void {
    const resolved = resolve(filePath)
    const imagesRoot = resolve(this.imagesDir)
    if (resolved.startsWith(imagesRoot) && existsSync(resolved)) unlinkSync(resolved)
  }

  private getImageFileSize(filePath: unknown): number | null {
    if (!filePath) return null
    try {
      const resolved = resolve(String(filePath))
      if (!existsSync(resolved)) return null
      const stat = statSync(resolved)
      return stat.isFile() ? stat.size : null
    } catch {
      return null
    }
  }
}

function normalizeReferenceMimeType(mimeType: string, name: string): string {
  const normalized = mimeType.toLowerCase()
  if (referenceMimeTypes.has(normalized)) return normalized === 'image/jpg' ? 'image/jpeg' : normalized
  const extension = extensionFromName(name)
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg'
  if (extension === '.png') return 'image/png'
  if (extension === '.webp') return 'image/webp'
  throw new Error('仅支持 PNG、JPG、WEBP 参考图。')
}

function extensionFromName(name: string): string | null {
  const extension = extname(name).toLowerCase()
  if (extension === '.jpeg') return '.jpg'
  if (extension === '.jpg' || extension === '.png' || extension === '.webp') return extension
  return null
}

function mimeTypeFromExtension(extension: string): string {
  const normalized = extension.toLowerCase()
  if (normalized === '.jpg' || normalized === '.jpeg') return 'image/jpeg'
  if (normalized === '.webp') return 'image/webp'
  return 'image/png'
}
