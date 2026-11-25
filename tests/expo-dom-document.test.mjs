import test from 'node:test'
import assert from 'node:assert/strict'
import { allowsLocalDocument, resolveUpdateDocument } from '../src/expo/domDocument.ts'

const key = '65f58a5e4dcf923d6901e48f97565003'
const updateDocument = `file:///data/user/0/host.exp.exponent/files/updates/${key}.html`

test('Expo Go opens the DOM entry reported by the native update', () => {
  const document = resolveUpdateDocument({
    '96ae946e0bc4c04a85865f5c6c0d438a': 'file:///data/app/96ae946e0bc4c04a85865f5c6c0d438a.js',
    [key]: updateDocument,
  })
  assert.equal(document, updateDocument)
  assert.equal(allowsLocalDocument(`${document}#/settings`, document), true)
  assert.equal(allowsLocalDocument(`file:///elsewhere/${key}.html`, document), false)
  assert.equal(allowsLocalDocument(`${document}?other=1`, document), false)
})

test('only the downloaded entry or an embedded app document can use the bridge', () => {
  assert.equal(resolveUpdateDocument({ [key]: `https://example.com/${key}.html` }), undefined)
  assert.equal(resolveUpdateDocument({ [key]: 'file:///data/app/unrelated.html' }), undefined)
  assert.equal(allowsLocalDocument(`file:///android_asset/www.bundle/${key}.html#/`), true)
  assert.equal(allowsLocalDocument(`file://remote/.expo-internal/${key}.html`), false)
  assert.equal(allowsLocalDocument(`https://example.com/.expo-internal/${key}.html`), false)
})
