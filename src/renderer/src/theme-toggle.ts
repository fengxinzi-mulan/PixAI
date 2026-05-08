export function getThemeToggleView(darkMode: boolean): { label: string; switchClassName: string } {
  return {
    label: darkMode ? '黑夜模式' : '白天模式',
    switchClassName: darkMode ? 'switch' : 'switch off'
  }
}
