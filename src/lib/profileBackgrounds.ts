export const PROFILE_BACKGROUNDS = [
  { id: 'sakura_video', label: 'profileBackground.sakuraVideo', poster: '/assets/profile-sakura-poster.jpg', video: '/assets/profile-sakura-video.mp4', premium: false },
  { id: 'autumn_video', label: 'profileBackground.autumnVideo', poster: '/assets/profile-autumn-poster.jpg', video: '/assets/profile-autumn-video.mp4', premium: false },
  { id: 'moon_sakura', label: 'profileBackground.moonSakura', poster: '/assets/profile-moon-sakura.jpg', video: '', premium: false },
  { id: 'ember_maple', label: 'profileBackground.emberMaple', poster: '/assets/profile-ember-maple.jpg', video: '', premium: false },
  { id: 'storm_field', label: 'profileBackground.newStorm', poster: '/assets/bg-storm.jpg', video: '', premium: true },
  { id: 'aurora_sky', label: 'profileBackground.newAurora', poster: '/assets/bg-aurora.jpg', video: '', premium: true },
  { id: 'nebula', label: 'profileBackground.newNebula', poster: '/assets/bg-nebula.jpg', video: '', premium: true },
  { id: 'ocean_night', label: 'profileBackground.newOcean', poster: '/assets/bg-ocean.jpg', video: '', premium: true },
  { id: 'fireflies', label: 'profileBackground.newFireflies', poster: '/assets/bg-fireflies.jpg', video: '', premium: true },
  { id: 'rain_city', label: 'profileBackground.newRain', poster: '/assets/bg-rain.jpg', video: '', premium: true },
  { id: 'volcano', label: 'profileBackground.newVolcano', poster: '/assets/bg-embers.jpg', video: '', premium: true },
  { id: 'snow_forest', label: 'profileBackground.newSnow', poster: '/assets/bg-snow.jpg', video: '', premium: true },
  { id: 'lantern_lake', label: 'profileBackground.newLanterns', poster: '/assets/bg-lantern.jpg', video: '', premium: true },
  { id: 'desert_night', label: 'profileBackground.newDesert', poster: '/assets/bg-desert.jpg', video: '', premium: true },
  { id: 'underwater', label: 'profileBackground.newUnderwater', poster: '/assets/bg-underwater.svg', video: '', premium: true },
] as const
export type ProfileBackground = '' | typeof PROFILE_BACKGROUNDS[number]['id']
export function isProfileBackground(value: unknown): value is ProfileBackground {
  return value === '' || PROFILE_BACKGROUNDS.some(item => item.id === value)
}

export function isPremiumBackground(value: unknown): boolean {
  return PROFILE_BACKGROUNDS.some(item => item.id === value && item.premium)
}
