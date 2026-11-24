const startup = document.getElementById('startup')

function showStartupFailure() {
  startup?.setAttribute('data-failed', '')
}

document.getElementById('startup-retry')?.addEventListener('click', async (event) => {
  event.preventDefault()
  const registration = navigator.serviceWorker?.getRegistration().catch(() => undefined)
  await Promise.race([
    registration?.then((worker) => worker?.update()).catch(() => undefined),
    new Promise((resolve) => window.setTimeout(resolve, 2000)),
  ])
  window.location.reload()
})

void import('./main').catch((error: unknown) => {
  showStartupFailure()
  console.error('Digital Brain startup failed', error)
})
