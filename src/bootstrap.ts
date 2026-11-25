document.getElementById('startup-retry')?.addEventListener('click', async (event) => {
  event.preventDefault()
  const registration = navigator.serviceWorker?.getRegistration().catch(() => undefined)
  await Promise.race([
    registration?.then((worker) => worker?.update()).catch(() => undefined),
    new Promise((resolve) => window.setTimeout(resolve, 2000)),
  ])
  window.location.reload()
})

if (!__DEV__ && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
      console.error('Digital Brain offline setup failed', error)
    })
  }, { once: true })
}
