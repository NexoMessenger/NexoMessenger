import type { IconProps } from './icons'
function base({size=22,...rest}:IconProps) {return {width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,'aria-hidden':true as const,focusable:false,...rest}}
export const NavChats=(p:IconProps)=><svg {...base(p)}><path d="M20.5 11.2a8.2 8.2 0 0 1-8.5 8.1c-1.3 0-2.5-.3-3.6-.8L4 20l1.2-4a8.1 8.1 0 1 1 15.3-4.8Z"/><path d="M8.1 10.2h7.8M8.1 13.5h5.2"/></svg>
export const NavGroups=(p:IconProps)=><svg {...base(p)}><circle cx="9" cy="8" r="3"/><path d="M3.3 19.3c.4-3.3 2.6-5.1 5.7-5.1s5.4 1.8 5.8 5.1"/><path d="M16 5.7a3 3 0 0 1 0 5.7M17 14.3c2.2.3 3.6 2 3.8 4.5"/></svg>
export const NavChannel=(p:IconProps)=><svg {...base(p)}><path d="M4 9.3v5.4h3.8l10 3.7V5.6l-10 3.7H4Z"/><path d="m7.8 14.8 1.3 4.3h2.7l-1.1-3.5M20.8 9.3v5.4"/></svg>
export const NavGift=(p:IconProps)=><svg {...base(p)}><rect x="4" y="9" width="16" height="11" rx="2.2"/><path d="M3.5 9h17v3.3h-17zM12 9v11M12 9c-1.1 0-4.7-.1-4.7-2.5a2.1 2.1 0 0 1 3.8-1.2C11.7 6 12 7.3 12 9Zm0 0c1.1 0 4.7-.1 4.7-2.5a2.1 2.1 0 0 0-3.8-1.2C12.3 6 12 7.3 12 9Z"/></svg>
export const NavSearch=(p:IconProps)=><svg {...base(p)}><circle cx="10.8" cy="10.8" r="6.5"/><path d="m15.7 15.7 4.3 4.3"/></svg>
export const NavProfile=(p:IconProps)=><svg {...base(p)}><circle cx="12" cy="8" r="3.4"/><path d="M4.8 20c.4-3.6 3.2-5.8 7.2-5.8s6.8 2.2 7.2 5.8"/></svg>
export const NavSettings=(p:IconProps)=><svg {...base(p)}><path d="M4 6.5h16M4 12h16M4 17.5h16"/><circle cx="8" cy="6.5" r="2" fill="var(--surface,#161420)"/><circle cx="16" cy="12" r="2" fill="var(--surface,#161420)"/><circle cx="9.5" cy="17.5" r="2" fill="var(--surface,#161420)"/></svg>
