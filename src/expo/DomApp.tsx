'use dom'

import '../styles/fonts.generated.css'
import '../styles/tokens.css'
import '../styles/global.css'
import { StrictMode, useEffect } from 'react'
import type { DOMProps } from 'expo/dom'
import App from '../App'
import { router } from '../routes/router'
import { AUTH_REDIRECT, CALENDAR_REDIRECT, DeviceContext } from './device'
import { handleAuthReturn } from './authReturn'
import { queryClient } from '../lib/queryClient'
import type { ContextType } from 'react'

type Props = NonNullable<ContextType<typeof DeviceContext>> & {
  dom?: DOMProps
  incomingUrl: string
  incomingSequence: number
  backRequest: number
  setCanGoBack: (canGoBack: boolean) => Promise<void>
  onDomReady?: () => Promise<void>
}

export default function DomApp({ incomingUrl, incomingSequence, backRequest, setCanGoBack, onDomReady, ...device }: Props) {
  const { isExpoGo, foregroundSequence } = device
  useEffect(() => {
    void onDomReady?.()
  }, [onDomReady])

  useEffect(() => {
    document.documentElement.lang = 'pt-BR'
    const reportHistory = () => {
      void setCanGoBack(window.history.state?.idx > 0)
    }
    reportHistory()
    return router.subscribe(reportHistory)
  }, [setCanGoBack])

  useEffect(() => {
    if (backRequest && window.history.state?.idx > 0) void router.navigate(-1)
  }, [backRequest])

  useEffect(() => {
    if (!isExpoGo || !foregroundSequence) return
    void queryClient.invalidateQueries({ queryKey: ['google-calendar-connection'] })
    void queryClient.invalidateQueries({ queryKey: ['calendar'] })
  }, [isExpoGo, foregroundSequence])

  useEffect(() => {
    if (!incomingUrl || incomingSequence === 0) return
    const url = new URL(incomingUrl)
    if (`${url.protocol}//${url.host}` === AUTH_REDIRECT &&
        (url.pathname === '/reset-password' || url.pathname === '/signup')) {
      void handleAuthReturn(url)
        .then((path) => path && router.navigate(path, { replace: true }))
        .catch((error: unknown) => console.error('Digital Brain authentication failed', error))
    } else if (`${url.protocol}//${url.host}` === CALENDAR_REDIRECT) {
      const status = url.searchParams.get('calendar')
      if (status === 'connected' || status === 'denied' || status === 'error') {
        void router.navigate(`/?calendar=${status}`, { replace: true })
      }
    }
  }, [incomingUrl, incomingSequence])

  return (
    <StrictMode>
      <DeviceContext.Provider value={device}>
        <App />
      </DeviceContext.Provider>
    </StrictMode>
  )
}
