document.getElementById('startup-retry')?.addEventListener('click', async (event) => {
  event.preventDefault()
  const registration = navigator.serviceWorker?.getRegistration().catch(() => undefined)
  await Promise.race([
    registration?.then((worker) => worker?.update()).catch(() => undefined),
    new Promise((resolve) => window.setTimeout(resolve, 2000)),
  ])
  window.location.reload()
})
