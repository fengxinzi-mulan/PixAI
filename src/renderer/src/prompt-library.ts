import type { ImageQuality, ImageRatio } from '@shared/types'
import { getDefaultImageSize, getImageSizeOptions } from '@shared/image-options'

export type PromptTemplate = {
  id: string
  title: string
  category: string
  description: string
  prompt: string
  tags: string[]
  ratio: ImageRatio
  resolution: string
  quality: ImageQuality
}

export type PromptLibraryItem = PromptTemplate

export type PromptTemplateInput = Omit<PromptTemplate, 'id'>

type LegacyPromptTemplateRecord = Partial<PromptTemplate> & {
  promptZh?: unknown
  promptEn?: unknown
  sourceLabel?: unknown
  sourceUrl?: unknown
}

export function createEmptyPromptTemplateInput(): PromptTemplateInput {
  return {
    title: '',
    category: '',
    description: '',
    prompt: '',
    tags: [],
    ratio: '1:1',
    resolution: getDefaultImageSize('1:1'),
    quality: 'auto'
  }
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'luxury-watch-ad',
    title: '奢华腕表广告',
    category: '商业海报',
    description: '适合高端品牌主视觉，强调金属、黑金配色和广告级质感。',
    prompt: '奢华腕表广告海报，深黑色影棚，镜面反射地面，腕表居中作为主视觉，强烈轮廓光，精细金属纹理，低调金色点缀，高级杂志摄影感，清晰阴影，高对比，超细节。',
    tags: ['广告', '腕表', '黑金', '高对比'],
    ratio: '1:1',
    resolution: getDefaultImageSize('1:1'),
    quality: 'high'
  },
  {
    id: 'minimal-product-shot',
    title: '极简产品主图',
    category: '产品摄影',
    description: '适合电商主图、独立站商品页和极简品牌展示。',
    prompt: '极简产品摄影，干净白色背景，物体下方柔和阴影，留白均衡，轻微反射，居中构图，边缘清晰，自然影棚光，真实材质，高级商业成片质感。',
    tags: ['电商', '主图', '极简', '棚拍'],
    ratio: '4:3',
    resolution: getDefaultImageSize('4:3'),
    quality: 'auto'
  },
  {
    id: 'neon-portrait',
    title: '霓虹肖像',
    category: '人物肖像',
    description: '适合人物海报、社媒头像和电影感氛围图。',
    prompt: '电影感人物肖像，人物处于霓虹分割光中，深色都市背景，皮肤高光有反射，发丝略被风吹动，浅景深，目光强烈，时尚编辑氛围，青蓝与洋红调色，胶片颗粒，真实皮肤质感。',
    tags: ['肖像', '霓虹', '电影感', '人像'],
    ratio: '3:4',
    resolution: getDefaultImageSize('3:4'),
    quality: 'high'
  },
  {
    id: 'fashion-editorial',
    title: '时尚编辑大片',
    category: '时尚编辑',
    description: '适合杂志感人物、服饰 lookbook 和高端审美展示。',
    prompt: '时尚编辑肖像，模特坐在干净的影棚布景中，姿态雕塑感强，轮廓鲜明，设计师服装，受控硬光，阴影精致，面料有光泽，低饱和配色，奢华杂志封面氛围，清晰对焦。',
    tags: ['时尚', '杂志', '编辑', '服装'],
    ratio: '3:4',
    resolution: getDefaultImageSize('3:4'),
    quality: 'high'
  },
  {
    id: 'sports-poster',
    title: '运动海报',
    category: '运动广告',
    description: '适合球星、运动品牌和高冲击力宣传图。',
    prompt: '运动宣传海报，运动员姿态强劲，深色影棚背景，戏剧性的侧光，光滑地面反射，轻微运动拖影，预留品牌文案区域，能量感强，超写实，高对比，电影式构图。',
    tags: ['运动', '海报', '冲击力', '品牌'],
    ratio: '16:9',
    resolution: getDefaultImageSize('16:9'),
    quality: 'high'
  },
  {
    id: 'storyboard-grid',
    title: '四宫格故事板',
    category: '故事板',
    description: '适合流程展示、分镜叙事和动作阶段变化。',
    prompt: '四格故事板，四个连续画面，同一角色和一致服装，故事推进清晰，背景变化简单，动作可读，分镜分隔干净，编辑式排版，带有标注感但不要真实文字，精致概念设计风格。',
    tags: ['分镜', '叙事', '多格', '流程'],
    ratio: '16:9',
    resolution: getDefaultImageSize('16:9'),
    quality: 'medium'
  },
  {
    id: 'sticker-sheet',
    title: '贴纸包',
    category: '贴纸包',
    description: '适合表情包、角色贴纸和社交媒体素材包。',
    prompt: '高质量贴纸页，同一个卡通角色拥有多种表情和姿势，干净白色背景，粗线条轮廓，明快颜色，可直接抠图的边缘，俏皮构图，不要额外文字，不要水印，保持统一设计语言。',
    tags: ['贴纸', '表情包', '角色', '套图'],
    ratio: '1:1',
    resolution: getDefaultImageSize('1:1'),
    quality: 'high'
  },
  {
    id: 'infographic-product',
    title: '产品信息图',
    category: '信息图',
    description: '适合功能说明、卖点拆解和对比海报。',
    prompt: '干净的信息图风格产品视觉，大主体产品，悬浮说明区域，简单几何结构，留白均衡，预留清晰文字区域，柔和阴影，排版精致，现代商业设计，阅读性强的构图。',
    tags: ['信息图', '卖点', '说明', '布局'],
    ratio: '3:2',
    resolution: getDefaultImageSize('3:2'),
    quality: 'medium'
  },
  {
    id: 'interior-mood',
    title: '空间氛围图',
    category: '空间设计',
    description: '适合室内设计、品牌空间和建筑气质展示。',
    prompt: '建筑空间氛围图，温暖自然光，多层次材质，平静构图，触感清晰的表面，现代家具，柔和阴影，精致配色，宽松取景，高级设计杂志审美。',
    tags: ['空间', '建筑', '室内', '材质'],
    ratio: '3:2',
    resolution: getDefaultImageSize('3:2'),
    quality: 'high'
  },
  {
    id: 'food-editorial',
    title: '美食封面',
    category: '食物摄影',
    description: '适合菜单封面、餐饮海报和食材视觉。',
    prompt: '编辑式美食摄影，近景主菜，蒸汽与纹理清晰可见，深色或暖色桌面，受控高光，诱人的色彩平衡，浅景深，精致餐厅氛围，高级杂志风格。',
    tags: ['美食', '餐饮', '食材', '封面'],
    ratio: '1:1',
    resolution: getDefaultImageSize('1:1'),
    quality: 'high'
  },
  {
    id: 'cinematic-poster',
    title: '电影海报',
    category: '电影封面',
    description: '适合剧情海报、概念影片和角色主视觉。',
    prompt: '电影感海报，主角剪影居中，戏剧性环境，多层光束，氛围压抑，强烈对比，电影级调色，适合放标题的构图，空气中有尘雾或烟雾，悬念感强，完成度高。',
    tags: ['电影', '海报', '概念', '角色'],
    ratio: '2:3',
    resolution: getDefaultImageSize('2:3'),
    quality: 'high'
  },
  {
    id: 'glass-ui-card',
    title: '玻璃态界面',
    category: 'UI 视觉',
    description: '适合产品演示、界面概念图和未来感视觉稿。',
    prompt: '未来感玻璃态 UI 卡片悬浮在空间中，透明层叠，柔和反射，低调发光，深色渐变环境，精确间距，优雅界面组件，现代产品设计 mockup，真实材质，干净构图。',
    tags: ['UI', '玻璃态', '概念', '产品'],
    ratio: '16:9',
    resolution: getDefaultImageSize('16:9'),
    quality: 'medium'
  }
]

const PROMPT_LIBRARY_STORAGE_KEY = 'pixai.prompt-library.items.v1'

export type PromptTemplateFilterOptions = {
  query?: string
  category?: string
  ratio?: ImageRatio | 'all'
  quality?: ImageQuality | 'all'
}

export function getPromptTemplateCategories(templates: PromptTemplate[] = PROMPT_TEMPLATES): string[] {
  return Array.from(new Set(templates.map((template) => template.category)))
}

export function filterPromptTemplates<T extends PromptTemplate = PromptTemplate>(
  templates: T[] = PROMPT_TEMPLATES as T[],
  options: PromptTemplateFilterOptions = {}
): T[] {
  const query = options.query?.trim().toLowerCase() || ''
  return templates.filter((template) => {
    if (options.category && options.category !== 'all' && template.category !== options.category) return false
    if (options.ratio && options.ratio !== 'all' && template.ratio !== options.ratio) return false
    if (options.quality && options.quality !== 'all' && template.quality !== options.quality) return false
    if (!query) return true

    const haystack = [template.title, template.category, template.description, template.prompt, template.tags.join(' '), template.resolution]
      .join(' ')
      .toLowerCase()

    return haystack.includes(query)
  })
}

export function getPromptLibraryItems(): PromptLibraryItem[] {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(PROMPT_LIBRARY_STORAGE_KEY)
  if (!raw) {
    savePromptLibraryItems(PROMPT_TEMPLATES)
    return PROMPT_TEMPLATES
  }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.map((item) => normalizePromptLibraryItem(item)).filter((item): item is PromptLibraryItem => item != null)
  } catch {
    return []
  }
}

export function createPromptLibraryItem(input: PromptTemplateInput): PromptLibraryItem {
  const template = normalizePromptTemplate(input, createPromptTemplateId())
  if (!template) throw new Error('Invalid prompt template.')
  const next = [template, ...getPromptLibraryItems().filter((entry) => entry.id !== template.id)]
  savePromptLibraryItems(next)
  return template
}

export function updatePromptLibraryItem(id: string, input: PromptTemplateInput): PromptLibraryItem {
  const items = getPromptLibraryItems()
  const index = items.findIndex((item) => item.id === id)
  if (index < 0) throw new Error('Prompt template not found.')
  const updated = normalizePromptTemplate({ ...input, id }, id)
  if (!updated) throw new Error('Invalid prompt template.')
  const next = [...items]
  next[index] = updated
  savePromptLibraryItems(next)
  return updated
}

export function deletePromptLibraryItem(id: string): void {
  savePromptLibraryItems(getPromptLibraryItems().filter((item) => item.id !== id))
}

export function clonePromptTemplate(template: PromptTemplate): PromptTemplateInput {
  return {
    title: template.title,
    category: template.category,
    description: template.description,
    prompt: template.prompt,
    tags: [...template.tags],
    ratio: template.ratio,
    resolution: template.resolution,
    quality: template.quality
  }
}

function savePromptLibraryItems(items: PromptTemplate[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PROMPT_LIBRARY_STORAGE_KEY, JSON.stringify(items))
}

function normalizePromptTemplate(input: unknown, id = createPromptTemplateId()): PromptTemplate | null {
  if (!input || typeof input !== 'object') return null
  const record = input as LegacyPromptTemplateRecord
  const title = safeText(record.title)
  const category = safeText(record.category)
  const description = safeText(record.description)
  const prompt = safeText(record.prompt) || safeText(record.promptZh)
  if (!title || !category || !description || !prompt) return null
  const ratio = isImageRatio(record.ratio) ? record.ratio : '1:1'
  const quality = isImageQuality(record.quality) ? record.quality : 'auto'
  return {
    id,
    title,
    category,
    description,
    prompt,
    tags: normalizeTags(record.tags),
    ratio,
    resolution: normalizeResolution(ratio, record.resolution),
    quality
  }
}

function normalizePromptLibraryItem(input: unknown): PromptLibraryItem | null {
  return normalizePromptTemplate(input, safeText((input as Partial<PromptTemplate> | null)?.id) || createPromptTemplateId())
}

function normalizeResolution(ratio: ImageRatio, value: unknown): string {
  const candidate = safeText(value)
  if (candidate && getImageSizeOptions(ratio).some((option) => option.value === candidate)) return candidate
  return getDefaultImageSize(ratio)
}

function safeText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => safeText(item)).filter(Boolean)
}

function isImageRatio(value: unknown): value is ImageRatio {
  return typeof value === 'string' && ['1:1', '3:2', '2:3', '4:3', '3:4', '16:9', '9:16', '21:9', '9:21'].includes(value)
}

function isImageQuality(value: unknown): value is ImageQuality {
  return typeof value === 'string' && ['auto', 'low', 'medium', 'high'].includes(value)
}

function createPromptTemplateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `custom-${crypto.randomUUID()}`
  }
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
