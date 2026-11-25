import { generateSW } from 'workbox-build'
import { readFile, writeFile } from 'node:fs/promises'

const htmlPath = 'dist/index.html'
const html = await readFile(htmlPath, 'utf8')
const registration = `<script id="register-service-worker">
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch((error) => {
    console.error('Digital Brain offline setup failed', error)
  })
}
</script>`
if (!html.includes('id="register-service-worker"')) {
  await writeFile(htmlPath, html.replace('</body>', `${registration}\n</body>`))
}

const { warnings } = await generateSW({
  globDirectory: 'dist',
  globPatterns: ['**/*.{html,js,css,json,webmanifest,png,svg,woff,woff2}'],
  globIgnores: ['sw.js', 'workbox-*.js'],
  maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
  swDest: 'dist/sw.js',
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  runtimeCaching: [
    {
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkOnly',
      options: { precacheFallback: { fallbackURL: '/index.html' } },
    },
  ],
})

for (const warning of warnings) console.warn(warning)
