import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('chat shortcuts share spacing and mobile navigation remains glass and clickable', async () => {
 const chats=await readFile('src/pages/ChatsPage.tsx','utf8'), css=await readFile('src/index.css','utf8'), layout=await readFile('src/components/Layout.tsx','utf8')
 assert.match(chats,/className="chats-shortcuts"/)
 assert.match(css,/\.chats-shortcuts \{[^}]*gap:10px;[^}]*margin-bottom:10px/)
 assert.match(css,/\.chats-page \.row-preview \{[^}]*text-overflow:ellipsis/)
 assert.match(css,/\.bottom-nav \.nav-item \{[^}]*text-decoration:none/)
 assert.match(css,/backdrop-filter:blur\(24px\)/)
 assert.match(css,/bottom:max\(8px, env\(safe-area-inset-bottom\)\)/)
 assert.match(css,/padding:6px 5px; gap:1px; border-radius:26px/)
 assert.match(css,/padding-bottom:calc\(96px \+ env\(safe-area-inset-bottom\)\)/)
 assert.match(css,/\.app-shell\.in-room \.bottom-nav \{ display: none; \}/)
 assert.match(layout,/NavLink key=\{n\.to\} to=\{n\.to\}/)
})
