import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'

// Compile the pure helpers without requiring a browser or a speech engine.
const source = readFileSync(new URL('../src/lib/astraVoice.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const exports = {}
vm.runInNewContext(compiled, { exports, require: createRequire(import.meta.url), window: undefined })
const { speechChunks, voicesForLanguage } = exports

test('speech chunks preserve text and bound long words including emoji', () => {
  const text = 'Привет. ' + 'длинно'.repeat(90) + ' ' + '😀'.repeat(200)
  const chunks = speechChunks(text)
  assert.ok(chunks.length > 1)
  assert.ok(chunks.every(c => Array.from(c).length <= 180))
  assert.equal(chunks.join('').replace(/\s/g, ''), text.replace(/\s/g, ''))
  assert.deepEqual(Array.from(speechChunks('  ')), [])
})

test('voice choices match language and prefer recognizable feminine voices', () => {
  const voices = [
    { name: 'Pavel male', lang: 'ru-RU' }, { name: 'Irina female', lang: 'ru-RU' },
    { name: 'English voice', lang: 'en-US' }, { name: '中文', lang: 'zh-CN' },
  ]
  assert.deepEqual(Array.from(voicesForLanguage(voices, 'ru'), v => v.name), ['Irina female', 'Pavel male'])
  assert.deepEqual(Array.from(voicesForLanguage(voices, 'zh-CN'), v => v.name), ['中文'])
  assert.equal(voicesForLanguage(voices, 'uk').length, 0)
})
