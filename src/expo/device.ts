import { createContext, useContext } from 'react'
import { IS_DOM } from 'expo/dom'
import { Asset } from 'expo-asset'
import icon from '../../public/icons/icon-192.png'

export const isNative = IS_DOM
export const AUTH_REDIRECT = 'digitalbrain://auth'
export const CALENDAR_REDIRECT = 'digitalbrain://calendar'
export const appIcon = isNative
  ? Asset.fromModule(icon).uri
  : `${process.env.EXPO_BASE_URL || '/'}icons/icon-192.png`

interface DeviceActions {
  isExpoGo: boolean
  foregroundSequence: number
  openAuth: (url: string, redirect: string) => Promise<string | null>
  openLink: (url: string) => Promise<void>
  shareText: (text: string, url?: string) => Promise<void>
  copyText: (text: string) => Promise<void>
  exportJson: (year: number, json: string) => Promise<void>
  vibrate: () => Promise<void>
  setTheme: (theme: 'light' | 'dark') => Promise<void>
  takePhoto: (facing: 'environment' | 'user') => Promise<{ base64: string; mimeType: string } | null>
  pickPhoto: () => Promise<{ base64: string; mimeType: string } | null>
}

export const DeviceContext = createContext<DeviceActions | null>(null)
export const useDevice = () => useContext(DeviceContext)

export function publicAppOrigin() {
  if (!isNative) return window.location.origin
  const url = process.env.EXPO_PUBLIC_APP_URL
  if (!url) throw new Error('Endereço público do Hebbian indisponível.')
  return new URL(url).origin
}
