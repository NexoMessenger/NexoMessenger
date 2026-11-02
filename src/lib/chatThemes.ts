import type { CSSProperties } from 'react'
import type { Locale } from '../i18n/translations'

// The first four IDs are kept for users who chose an earlier theme.
export const CHAT_THEMES = [
  { id: 'default', names: ['Default', 'По умолчанию', 'Типова', '默认'], icon: '✦', colors: ['#211a35', '#6556b5', '#30294a'], effect: 'stars' },
  { id: 'ocean', names: ['Ocean', 'Океан', 'Океан', '海洋'], icon: '◈', colors: ['#071d2b', '#247a98', '#23465e'], effect: 'bubbles' },
  { id: 'sakura', names: ['Sakura', 'Сакура', 'Сакура', '樱花'], icon: '✿', colors: ['#2a1023', '#a34279', '#603655'], effect: 'petals' },
  { id: 'night', names: ['Night', 'Ночь', 'Ніч', '夜晚'], icon: '☾', colors: ['#10102a', '#564d9d', '#373459'], effect: 'stars' },
  { id: 'stardust', names: ['Stardust', 'Звёздная пыль', 'Зоряний пил', '星尘'], icon: '✦', colors: ['#0d1025', '#6355b2', '#323558'], effect: 'stars' },
  { id: 'snowfall', names: ['Snowfall', 'Снегопад', 'Снігопад', '飘雪'], icon: '❄', colors: ['#0c1b29', '#4b809b', '#304653'], effect: 'snow' },
  { id: 'embers', names: ['Embers', 'Искры', 'Іскри', '余烬'], icon: '✧', colors: ['#26120d', '#a65c36', '#593b32'], effect: 'sparks' },
  { id: 'aurora', names: ['Aurora', 'Сияние', 'Сяйво', '极光'], icon: '✧', colors: ['#071d20', '#298970', '#214d49'], effect: 'stars' },
  { id: 'moonlight', names: ['Moonlight', 'Лунный свет', 'Місячне світло', '月光'], icon: '☾', colors: ['#101827', '#526f9e', '#35435d'], effect: 'stars' },
  { id: 'rose', names: ['Rose', 'Роза', 'Троянда', '玫瑰'], icon: '✿', colors: ['#270e1a', '#a34766', '#623748'], effect: 'petals' },
  { id: 'forest', names: ['Firefly forest', 'Лес светлячков', 'Ліс світлячків', '萤火森林'], icon: '✦', colors: ['#101e13', '#598143', '#354d34'], effect: 'fireflies' },
  { id: 'lavender', names: ['Lavender', 'Лаванда', 'Лаванда', '薰衣草'], icon: '✿', colors: ['#1b1128', '#8056a0', '#493656'], effect: 'petals' },
  { id: 'rain', names: ['Rain', 'Дождь', 'Дощ', '雨'], icon: '╱', colors: ['#0d1922', '#467489', '#314756'], effect: 'rain' },
  { id: 'cosmos', names: ['Cosmos', 'Космос', 'Космос', '宇宙'], icon: '✦', colors: ['#170d27', '#814aa8', '#4a335e'], effect: 'stars' },
  { id: 'ice', names: ['Ice crystal', 'Ледяной кристалл', 'Крижаний кристал', '冰晶'], icon: '❄', colors: ['#0c1e28', '#408da2', '#305665'], effect: 'snow' },
  { id: 'sunset', names: ['Afterglow', 'Закат', 'Захід сонця', '晚霞'], icon: '✧', colors: ['#281319', '#aa5657', '#633b42'], effect: 'sparks' },
  { id: 'neon', names: ['Neon', 'Неон', 'Неон', '霓虹'], icon: '◇', colors: ['#160e29', '#7955c5', '#443267'], effect: 'stars' },
  { id: 'deepsea', names: ['Deep sea', 'Морская глубина', 'Морська глибина', '深海'], icon: '◦', colors: ['#071c22', '#267a83', '#26515a'], effect: 'bubbles' },
  { id: 'gold', names: ['Golden night', 'Золотая ночь', 'Золота ніч', '金色之夜'], icon: '✧', colors: ['#211a0b', '#92712e', '#55482c'], effect: 'sparks' },
] as const
export type ChatTheme = typeof CHAT_THEMES[number]['id']
export type ChatThemeConfig = typeof CHAT_THEMES[number]
export function themeName(theme: ChatThemeConfig, locale: Locale) {
  return theme.names[({ en: 0, ru: 1, uk: 2, 'zh-CN': 3 } as const)[locale]]
}
export function themeStyle(theme: ChatThemeConfig): CSSProperties {
  return { '--chat-bg': theme.colors[0], '--chat-accent': theme.colors[1], '--chat-bubble': theme.colors[2] } as CSSProperties
}
