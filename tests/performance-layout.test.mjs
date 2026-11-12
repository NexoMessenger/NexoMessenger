import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
test('heavy routes load on demand and repeated profile polling keeps unchanged state', async () => {
 const app = await readFile('src/App.tsx','utf8')
 const auth = await readFile('src/lib/AuthContext.tsx','utf8')
 const css = await readFile('src/index.css','utf8')
 for (const page of ['AiPage','GamingPage','GiftsPage','ChatRoomPage']) assert.match(app, new RegExp(`lazy\\(\\(\\) => import\\('\\./pages/${page}'\\)\\)`))
 assert.match(app, /<Layout><Suspense fallback=/)
 assert.match(auth, /JSON\.stringify\(previous\) === JSON\.stringify\(p\) \? previous : p/)
 assert.match(auth, /setInterval\(\(\) => \{ void refresh\(\) \}, 10000\)/)
 assert.match(css, /\.chats-page \.row-card\.glass \{ backdrop-filter:none/)
 assert.match(css, /backdrop-filter:blur\(24px\)/)
})
