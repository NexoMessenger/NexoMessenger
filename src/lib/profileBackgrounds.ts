export const PROFILE_BACKGROUNDS = [
  { id: 'sakura_video', label: 'profileBackground.sakuraVideo', poster: '/assets/profile-sakura-poster.jpg', video: '/assets/profile-sakura-video.mp4' },
  { id: 'autumn_video', label: 'profileBackground.autumnVideo', poster: '/assets/profile-autumn-poster.jpg', video: '/assets/profile-autumn-video.mp4' },
  { id: 'moon_sakura', label: 'profileBackground.moonSakura', poster: '/assets/profile-moon-sakura.jpg', video: '' },
  { id: 'ember_maple', label: 'profileBackground.emberMaple', poster: '/assets/profile-ember-maple.jpg', video: '' },
] as const
export type ProfileBackground = '' | typeof PROFILE_BACKGROUNDS[number]['id']
export function isProfileBackground(value: unknown): value is ProfileBackground {
  return value === '' || PROFILE_BACKGROUNDS.some(item => item.id === value)
}
