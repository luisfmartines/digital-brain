import { generateSW } from 'workbox-build'

const { warnings } = await generateSW({
  globDirectory: 'dist',
  globPatterns: ['**/*.{html,js,css,json,webmanifest,png,svg,woff,woff2}'],
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
