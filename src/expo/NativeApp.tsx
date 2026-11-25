import { useEffect, useState } from 'react'
import { AppState, BackHandler, Linking, Platform, Share, StatusBar, Vibration } from 'react-native'
import Constants, { ExecutionEnvironment } from 'expo-constants'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { setStringAsync } from 'expo-clipboard'
import { File, Paths } from 'expo-file-system'
import { isAvailableAsync, shareAsync } from 'expo-sharing'
import { openAuthSessionAsync } from 'expo-web-browser'
import DomApp from './DomApp'
import { CALENDAR_REDIRECT } from './device'

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient

async function openLink(url: string) {
  if (new URL(url).protocol === 'https:') await Linking.openURL(url)
}

async function shareText(text: string, url?: string) {
  await Share.share({ title: 'Digital Brain', message: url ? `${text} ${url}` : text })
}

async function copyText(text: string) {
  await setStringAsync(text)
}

async function exportJson(year: number, json: string) {
  if (!await isAvailableAsync()) return
  const file = new File(Paths.cache, `digital-brain-habits-${year}.json`)
  file.create({ overwrite: true })
  file.write(json)
  await shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' })
}

async function vibrate() {
  Vibration.vibrate([0, 200, 100, 200])
}

function allowNavigation({ url }: { url: string }) {
  const page = new URL(url)
  // The DOM bridge is scoped to the embedded app document.
  if (page.protocol === 'file:') return /\/(?:www\.bundle|\.expo-internal)\/[a-f0-9]+\.html$/.test(page.pathname)
  return __DEV__ && page.pathname === '/_expo/@dom/DomApp.tsx' &&
    (page.searchParams.get('file')?.endsWith('/src/expo/DomApp.tsx') ?? false)
}

export default function NativeApp() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [incomingLink, setIncomingLink] = useState({ url: '', sequence: 0 })
  const [canGoBack, setCanGoBack] = useState(false)
  const [backRequest, setBackRequest] = useState(0)
  const [foregroundSequence, setForegroundSequence] = useState(0)

  async function openAuth(url: string, redirect: string) {
    const result = await openAuthSessionAsync(url, redirect)
    if (result.type !== 'success') return null
    if (redirect === CALENDAR_REDIRECT) {
      setIncomingLink((previous) => ({ url: result.url, sequence: previous.sequence + 1 }))
    }
    return result.url
  }

  useEffect(() => {
    let mounted = true
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (url.startsWith(CALENDAR_REDIRECT)) return
      setIncomingLink((previous) => ({ url, sequence: previous.sequence + 1 }))
    })
    void Linking.getInitialURL().then((url) => {
      if (mounted && url) setIncomingLink((previous) => previous.sequence ? previous : { url, sequence: 1 })
    })
    return () => {
      mounted = false
      subscription.remove()
    }
  }, [])

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) return false
      setBackRequest((request) => request + 1)
      return true
    })
    return () => subscription.remove()
  }, [canGoBack])

  useEffect(() => {
    if (!isExpoGo) return
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setForegroundSequence((sequence) => sequence + 1)
    })
    return () => subscription.remove()
  }, [])

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme === 'dark' ? '#111115' : '#f6faf7' }}>
        <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
        <DomApp
          isExpoGo={isExpoGo}
          foregroundSequence={foregroundSequence}
          dom={{
            style: { flex: 1 },
            useExpoDOMWebView: false,
            allowUniversalAccessFromFileURLs: Platform.OS === 'android',
            contentInsetAdjustmentBehavior: 'never',
            onShouldStartLoadWithRequest: allowNavigation,
          }}
          incomingUrl={incomingLink.url}
          incomingSequence={incomingLink.sequence}
          backRequest={backRequest}
          setCanGoBack={async (value) => setCanGoBack(value)}
          setTheme={async (value) => setTheme(value)}
          openAuth={openAuth}
          openLink={openLink}
          shareText={shareText}
          copyText={copyText}
          exportJson={exportJson}
          vibrate={vibrate}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  )
}
