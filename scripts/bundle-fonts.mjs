import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

const require = createRequire(import.meta.url)
const sheets = [
  '@fontsource-variable/space-grotesk/index.css',
  '@fontsource-variable/manrope/index.css',
  '@fontsource-variable/playfair-display/wght-italic.css',
]

// Metro does not resolve relative url() assets in CSS. Keep Fontsource's original
// faces, weights and Unicode ranges and embed the same WOFF2 files in both exports.
const css = await Promise.all(sheets.map(async (sheet) => {
  const path = require.resolve(sheet)
  let source = await readFile(path, 'utf8')
  for (const [reference, file] of source.matchAll(/url\((\.\/[^)]+\.woff2)\)/g)) {
    const data = await readFile(resolve(dirname(path), file))
    source = source.replace(reference, `url(data:font/woff2;base64,${data.toString('base64')})`)
  }
  return source
}))

await writeFile(new URL('../src/styles/fonts.generated.css', import.meta.url), css.join('\n'))
