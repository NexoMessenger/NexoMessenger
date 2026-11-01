/** Shared client-side catalogue; server validates the same IDs independently. */
export const CREATIVE_BADGES = [
  { id: 'starlight', color: '#cbb6ff', glow: '#936dff', motion: 'spark' },
  { id: 'aurora', color: '#93ffd8', glow: '#23c8a7', motion: 'drift' },
  { id: 'fire', color: '#ffbc60', glow: '#f35627', motion: 'rise' },
  { id: 'frost', color: '#d6f8ff', glow: '#60c9ff', motion: 'fall' },
  { id: 'lightning', color: '#fff392', glow: '#f7d030', motion: 'spark' },
  { id: 'ocean', color: '#8cecff', glow: '#158bdf', motion: 'drift' },
  { id: 'royal', color: '#ffdf82', glow: '#eaa92d', motion: 'spark' },
  { id: 'moon', color: '#e8dcff', glow: '#9275dd', motion: 'drift' },
  { id: 'rainbow', color: '#ffcce9', glow: '#bd79ff', motion: 'drift' },
  { id: 'rose', color: '#ff9daa', glow: '#ef3663', motion: 'fall' },
  { id: 'butterfly', color: '#e8a9ff', glow: '#b552ed', motion: 'drift' },
  { id: 'comet', color: '#a8cfff', glow: '#4f8fff', motion: 'fall' },
  { id: 'bubbles', color: '#a2efff', glow: '#59c6e9', motion: 'rise' },
  { id: 'music', color: '#f1a7fc', glow: '#c653ef', motion: 'rise' },
  { id: 'pixel', color: '#9dffb1', glow: '#42d66b', motion: 'spark' },
] as const
export type CreativeBadge = typeof CREATIVE_BADGES[number]['id']
export type NameBadge = '' | 'autumn' | 'clover' | 'sakura' | 'train' | CreativeBadge
export function isCreativeBadge(id: string | undefined): id is CreativeBadge {
  return CREATIVE_BADGES.some(badge => badge.id === id)
}
export function isNameBadge(id: unknown): id is NameBadge {
  return typeof id === 'string' && (['', 'autumn', 'clover', 'sakura', 'train'].includes(id) || isCreativeBadge(id))
}
