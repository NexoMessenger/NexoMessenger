import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { JSDOM } from 'jsdom'

test('public privacy policy contains contact and Google disclosure without draft placeholders', async () => {
  const html = await readFile(new URL('../public/privacy.html', import.meta.url), 'utf8')
  const doc = new JSDOM(html).window.document
  assert.equal(doc.documentElement.lang, 'ru')
  assert.match(doc.querySelector('h1').textContent, /Политика конфиденциальности/)
  assert.match(doc.body.textContent, /Артём Леончик Андреевич/)
  assert.equal(doc.querySelector('a[href="mailto:artemleoncik989@gmail.com"]').textContent, 'artemleoncik989@gmail.com')
  assert.match(doc.body.textContent, /Данные Google при входе через Google/)
  assert.match(doc.body.textContent, /сквозное шифрование не заявляется/)
  assert.doesNotMatch(doc.body.textContent, /Проект для согласования|\[уточнить\]|не следует обещать/i)
  assert.equal(doc.querySelector('a.back').getAttribute('href'), './')
})
