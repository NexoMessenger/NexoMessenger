import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
test('game status displays a localized playing label while explaining its limitations', async()=>{
 const page=await readFile('src/pages/GamingPage.tsx','utf8'), text=await readFile('src/lib/gamingText.ts','utf8')
 for (const label of ['Playing {game}', 'Играет в {game}', 'Грає в {game}', '正在玩 {game}']) assert.ok(text.includes(label))
 assert.match(page,/text\.playing\.replace\('\{game\}',activity\.name\)/)
 assert.match(page,/text\.activityHint/);assert.match(page,/api\.clearGameActivity\(\)/);assert.match(page,/role="alert"/)
})
