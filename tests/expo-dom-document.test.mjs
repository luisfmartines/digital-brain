import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { runInNewContext } from 'node:vm'
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

test('the Expo DOM entry waits for a late Android WebView bridge', () => {
  const require = createRequire(import.meta.url)
  const requireFromExpo = createRequire(require.resolve('expo/package.json'))
  const cliDir = dirname(requireFromExpo.resolve('@expo/cli/package.json'))
  const { getDomComponentHtml } = require(join(cliDir, 'build/src/start/server/middleware/DomComponentsMiddleware.js'))
  const html = getDomComponentHtml('http://localhost:8081/app.bundle')
  assert.match(html, /<script type="application\/expo-dom-entry" crossorigin src="\/\/localhost:8081\/app.bundle"><\/script>/)
  const bootstrap = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
    .find(([, body]) => body.includes('startWhenBridgeIsReady'))[1]

  const window = {}
  const pending = []
  const installed = []
  const initialProps = { names: [], props: { isExpoGo: true } }
  let documentReady
  const document = {
    addEventListener: (event, callback) => {
      assert.equal(event, 'DOMContentLoaded')
      documentReady = callback
    },
    querySelectorAll: () => [{
      src: 'http://localhost:8081/app.bundle',
      crossOrigin: 'anonymous',
      hasAttribute: (name) => name === 'crossorigin',
      replaceWith: (script) => installed.push(script),
    }],
    createElement: () => ({}),
  }
  runInNewContext(bootstrap, { window, document, setTimeout: (callback) => pending.push(callback) })
  documentReady()
  assert.equal(installed.length, 0)
  assert.equal(pending.length, 1)

  window.ReactNativeWebView = {
    injectedObjectJson: () => JSON.stringify({ EXPO_DOM_HOST_OS: 'android', initialProps }),
  }
  pending.shift()()
  assert.equal(window.$$EXPO_DOM_HOST_OS, 'android')
  assert.equal(JSON.stringify(window.$$EXPO_INITIAL_PROPS), JSON.stringify(initialProps))
  assert.deepEqual(installed, [{ async: false, crossOrigin: 'anonymous', src: 'http://localhost:8081/app.bundle' }])
  assert.equal(pending.length, 0)
})
