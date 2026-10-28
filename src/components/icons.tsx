import type { SVGProps } from 'react'

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number
}

function base({ size = 20, ...props }: IconProps) {
  return {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const, 'aria-hidden': true, focusable: false, ...props,
  }
}

/** Original NEXO brand mark: geometric "N" inside a rounded hex-glass shard. */
export function NexoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="nexo-g" x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#C4B5FD" /><stop offset="0.55" stopColor="#8B5CF6" /><stop offset="1" stopColor="#5B21B6" />
        </linearGradient>
      </defs>
      <path d="M24 3 41 12.5v23L24 45 7 35.5v-23L24 3Z" stroke="url(#nexo-g)" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M16 32.5v-17l16 17v-17" stroke="url(#nexo-g)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export const IconChats = (p: IconProps) => (
  <svg {...base(p)}><path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 21l1.9-5.6A8.5 8.5 0 1 1 21 11.5Z" /><path d="M8.5 10.5h7M8.5 13.5h4" /></svg>
)
export const IconGroups = (p: IconProps) => (
  <svg {...base(p)}><circle cx="9" cy="8.5" r="3.5" /><path d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5" /><circle cx="17.5" cy="9.5" r="2.8" /><path d="M16 15.2c2.9-.3 5 1.3 5.7 4.3" /></svg>
)
export const IconChannel = (p: IconProps) => (
  <svg {...base(p)}><path d="M3.5 10.5v3L8 15l1.5 5h2L10 14.5l9.5 3v-13L10 8H3.5v2.5Z" strokeLinejoin="round" /><path d="M6 15.5V18" /></svg>
)
export const IconSearch = (p: IconProps) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20.5 20.5-4.8-4.8" /></svg>
)
export const IconProfile = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5c1-3.8 4-5.7 7.5-5.7s6.5 1.9 7.5 5.7" /></svg>
)
export const IconSettings = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="3.2" /><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1" /></svg>
)
export const IconBell = (p: IconProps) => (
  <svg {...base(p)}><path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10Z" /><path d="M10 19a2.2 2.2 0 0 0 4 0" /></svg>
)
export const IconAttach = (p: IconProps) => (
  <svg {...base(p)}><path d="m20.3 11.7-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l9.3-9.3a3.7 3.7 0 0 1 5.2 5.2l-9.2 9.3a1.8 1.8 0 0 1-2.6-2.6l8.5-8.6" /></svg>
)
export const IconImage = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="4.5" width="18" height="15" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="m5 18 5-5 3 3 3-3 3 3" /></svg>
)
export const IconFile = (p: IconProps) => (
  <svg {...base(p)}><path d="M6 2.8h8L19 8v13.2H6Z" strokeLinejoin="round" /><path d="M13.5 3v5.5H19" strokeLinejoin="round" /></svg>
)
export const IconSend = (p: IconProps) => (
  <svg {...base(p)}><path d="M21 3 10.2 13.8M21 3l-6.8 18-3.9-7.2L3 9.9 21 3Z" strokeLinejoin="round" /></svg>
)
export const IconCheck = (p: IconProps) => (
  <svg {...base(p)}><path d="m4.5 12.5 5 5 10-11" /></svg>
)
export const IconChecks = (p: IconProps) => (
  <svg {...base(p)}><path d="m2.5 13.5 4 4L15 8.5M11 17.5l1.2 1.2L21 10" /></svg>
)
export const IconBack = (p: IconProps) => (
  <svg {...base(p)}><path d="M19.5 12h-15M10 6l-6 6 6 6" /></svg>
)
export const IconClose = (p: IconProps) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>
)
export const IconEdit = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 20h4.5L20 8.5a2.4 2.4 0 0 0-3.5-3.5L5 16.5 4 20Z" strokeLinejoin="round" /><path d="m13.8 7.3 3.4 3.4" /></svg>
)
export const IconTrash = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 6.5h16M9.5 6V4h5v2M6.5 6.5 7.4 20h9.2l.9-13.5" strokeLinejoin="round" /></svg>
)
export const IconPlus = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>
)
export const IconMore = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="5.5" r="0.6" fill="currentColor" /><circle cx="12" cy="12" r="0.6" fill="currentColor" /><circle cx="12" cy="18.5" r="0.6" fill="currentColor" /></svg>
)
export const IconPalette = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.8 0-1.2-1-1.7-1-2.9 0-1 .8-1.8 2-1.8H17a4.5 4.5 0 0 0 4.5-4.5C21.3 6.4 17 3 12 3Z" /><circle cx="7.5" cy="10.5" r="0.7" fill="currentColor" /><circle cx="12" cy="7.5" r="0.7" fill="currentColor" /><circle cx="16.8" cy="10.3" r="0.7" fill="currentColor" /></svg>
)
export const IconGlobe = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.7 2.6 4 5.6 4 9s-1.3 6.4-4 9c-2.7-2.6-4-5.6-4-9s1.3-6.4 4-9Z" /></svg>
)
export const IconLogout = (p: IconProps) => (
  <svg {...base(p)}><path d="M14 4h5.5v16H14M10.5 8 6.5 12l4 4M6.5 12H15" strokeLinejoin="round" /></svg>
)
export const IconLock = (p: IconProps) => (
  <svg {...base(p)}><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /><circle cx="12" cy="15.3" r="1.2" fill="currentColor" stroke="none" /></svg>
)
export const IconShield = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 3 5 5.8v5.4c0 4.6 3 8 7 9.8 4-1.8 7-5.2 7-9.8V5.8L12 3Z" strokeLinejoin="round" /><path d="m9 11.8 2.2 2.2L15.5 9.7" /></svg>
)
export const IconEye = (p: IconProps) => (
  <svg {...base(p)}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></svg>
)
export const IconEyeOff = (p: IconProps) => (
  <svg {...base(p)}><path d="M4.5 5.2A11 11 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.3 3.9M6 8A16.6 16.6 0 0 0 2.5 12S6 18.5 12 18.5a10.8 10.8 0 0 0 3.4-.6" /><path d="M4 4l16 16" /></svg>
)
export const IconAlert = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 4 2.8 20h18.4L12 4Z" strokeLinejoin="round" /><path d="M12 10v4.2" /><circle cx="12" cy="17" r="0.7" fill="currentColor" stroke="none" /></svg>
)

/** Official multicolor Google "G" (brand asset for the OAuth button). */
export const IconGoogle = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.3h6.5a5.6 5.6 0 0 1-2.4 3.3v2.8h3.9c2.3-2.1 3.5-5.2 3.5-8.2Z" />
    <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-2.8c-1.1.7-2.4 1.2-4 1.2a7.1 7.1 0 0 1-6.7-4.9H1.3v3A12 12 0 0 0 12 24Z" />
    <path fill="#FBBC05" d="M5.3 14.6A7.2 7.2 0 0 1 4.9 12c0-.9.2-1.8.4-2.6V6.4H1.3a12 12 0 0 0 0 11.2l4-3Z" />
    <path fill="#EA4335" d="M12 4.5c1.8 0 3 .8 3.7 1.4l3.3-3.2A11.9 11.9 0 0 0 1.3 6.4l4 3A7.1 7.1 0 0 1 12 4.5Z" />
  </svg>
)
