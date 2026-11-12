// NEXO-run spaces, not official communities of the game publishers.
export const GAMING_WORLDS = [
 ['brawl', 'Brawl Stars', 'mobile-com.supercell.brawlstars'],
 ['standoff', 'Standoff 2', 'mobile-com.axlebolt.standoff2'],
 ['rust', 'Rust', 'rust'],
 ['cs2', 'Counter-Strike 2', 'steam-730'],
 ['dota', 'Dota 2', 'steam-570'],
 ['pubg-mobile', 'PUBG MOBILE', 'mobile-com.tencent.ig'],
 ['clash-royale', 'Clash Royale', 'mobile-com.supercell.clashroyale'],
 ['clash-clans', 'Clash of Clans', 'mobile-com.supercell.clashofclans'],
 ['roblox', 'Roblox', 'mobile-com.roblox.client'],
 ['free-fire', 'Free Fire', 'mobile-com.dts.freefireth'],
 ['cod-mobile', 'Call of Duty: Mobile', 'mobile-com.activision.callofduty.shooter'],
 ['apex', 'Apex Legends', 'steam-1172470'],
 ['gta', 'Grand Theft Auto V', 'steam-271590'],
 ['terraria', 'Terraria', 'steam-105600'],
 ['stardew', 'Stardew Valley', 'steam-413150'],
 ['among-us', 'Among Us', 'mobile-com.innersloth.spacemafia'],
].map(([key,name,game_id]) => ({ id:`nexo-world-${key}`, name, game_id, description:'', owner_id:'u_assistant', official:true }))
