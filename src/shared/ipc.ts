export const IPC_CHANNELS = {
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  imageGenerate: 'image:generate',
  imageCopy: 'image:copy',
  imageDownload: 'image:download',
  historyList: 'history:list',
  historyDelete: 'history:delete',
  historyFavorite: 'history:favorite',
  conversationList: 'conversation:list',
  conversationCreate: 'conversation:create',
  conversationUpdate: 'conversation:update',
  conversationDelete: 'conversation:delete',
  conversationRuns: 'conversation:runs',
  windowNewGenerator: 'window:new-generator'
} as const
