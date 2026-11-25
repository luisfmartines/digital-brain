import { createContext, useContext } from 'react'
import { IS_DOM } from 'expo/dom'

export const isNative = IS_DOM
export const AUTH_REDIRECT = 'digitalbrain://auth'
export const CALENDAR_REDIRECT = 'digitalbrain://calendar'
export const appIcon = `${process.env.EXPO_BASE_URL || (isNative ? './' : '/')}icons/icon-192.png`

interface DeviceActions {
  openAuth: (url: string, redirect: string) => Promise<string | null>
  openLink: (url: string) => Promise<void>
  shareText: (text: string, url?: string) => Promise<void>
  copyText: (text: string) => Promise<void>
  exportJson: (year: number, json: string) => Promise<void>
  vibrate: () => Promise<void>
  setTheme: (theme: 'light' | 'dark') => Promise<void>
}

export const DeviceContext = createContext<DeviceActions | null>(null)
export const useDevice = () => useContext(DeviceContext)

export function publicAppOrigin() {
  if (!isNative) return window.location.origin
  const url = process.env.EXPO_PUBLIC_APP_URL
  if (!url) throw new Error('Endereço público do Digital Brain indisponível.')
  return new URL(url).origin
}
