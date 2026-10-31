import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('identified Telegram emblems use the NEXO-edited art throughout the gift catalog', async () => {
  const catalog = await readFile('src/lib/giftCatalog.ts', 'utf8')
  for (const [key, variable, name] of [['nexo-velvet-ring','art5','velvet-ring'], ['nexo-rose-cap','extraArt29','rose-cap'], ['nexo-rainbow-cap','extraArt32','rainbow-cap']]) {
    assert.ok(catalog.includes(`import ${variable} from '../assets/gifts/nexo-rebranded/${name}.png'`))
    assert.ok(catalog.includes(`'${key}': ${variable}`))
    const file = await readFile(`src/assets/gifts/nexo-rebranded/${name}.png`)
    assert.deepEqual([...file.subarray(0, 8)], [137,80,78,71,13,10,26,10])
  }
  // Non-logo star gifts and animation assets remain independently mapped.
  assert.match(catalog, /'star-frog': starFrog/)
  assert.match(catalog, /'lucky-star': luckyStar/)
  assert.match(catalog, /'nexo-riders': nexoRidersVideo/)
  assert.match(catalog, /'nexo-sailor': sailorVideo/)
})
