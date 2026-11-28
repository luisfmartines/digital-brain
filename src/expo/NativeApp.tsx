import { useEffect, useState } from 'react'
import { ActivityIndicator, AppState, BackHandler, Button, Linking, Platform, Share, StatusBar, StyleSheet, Text, Vibration, View } from 'react-native'
import { requireOptionalNativeModule } from 'expo'
import Constants, { ExecutionEnvironment } from 'expo-constants'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { setStringAsync } from 'expo-clipboard'
import { File, Paths } from 'expo-file-system'
import { isAvailableAsync, shareAsync } from 'expo-sharing'
import { openAuthSessionAsync } from 'expo-web-browser'
import { CameraType, launchCameraAsync, launchImageLibraryAsync, requestCameraPermissionsAsync, type ImagePickerAsset } from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import DomApp from './DomApp'
import { CALENDAR_REDIRECT } from './device'
import { allowsLocalDocument, resolveUpdateDocument } from './domDocument'

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient
const isPublishedPreview = isExpoGo && !__DEV__

function getUpdateDocument() {
  if (!isPublishedPreview) return undefined
  const updates = requireOptionalNativeModule<{ localAssets?: Record<string, string> }>('ExpoUpdates')
  return resolveUpdateDocument(updates?.localAssets ?? {})
}

async function openLink(url: string) {
  if (new URL(url).protocol === 'https:') await Linking.openURL(url)
}

async function shareText(text: string, url?: string) {
  await Share.share({ title: 'Hebbian', message: url ? `${text} ${url}` : text })
}

async function copyText(text: string) {
  await setStringAsync(text)
}

async function exportJson(year: number, json: string) {
  if (!await isAvailableAsync()) return
  const file = new File(Paths.cache, `hebbian-habits-${year}.json`)
  file.create({ overwrite: true })
  file.write(json)
  await shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' })
}

async function vibrate() {
  Vibration.vibrate([0, 200, 100, 200])
}

async function preparePhoto(photo: ImagePickerAsset) {
  const { width, height } = photo
  const maxWidth = Math.max(1, Math.round(1280 * width / Math.max(width, height, 1)))
  const context = ImageManipulator.manipulate(photo.uri, { maxWidth })
  try {
    const image = await context.renderAsync()
    try {
      const options = { format: SaveFormat.JPEG, base64: true }
      let output = await image.saveAsync({ ...options, compress: 0.78 })
      if ((output.base64?.length ?? 0) > 400_000) output = await image.saveAsync({ ...options, compress: 0.58 })
      if (!output.base64) throw new Error('A foto está vazia.')
      return { base64: output.base64, mimeType: 'image/jpeg' }
    } finally {
      image.release()
    }
  } catch {
    throw new Error('Não foi possível preparar esta foto. Tente novamente ou escolha outra imagem.')
  } finally {
    context.release()
  }
}

async function takePhoto(facing: 'environment' | 'user') {
  const permission = await requestCameraPermissionsAsync()
  if (!permission.granted) {
    throw new Error('Permita o acesso à câmera nas configurações do celular e tente novamente.')
  }
  const result = await launchCameraAsync({
    cameraType: facing === 'user' ? CameraType.front : CameraType.back,
    mediaTypes: ['images'],
    exif: false,
  })
  return result.canceled ? null : preparePhoto(result.assets[0])
}

async function pickPhoto() {
  const result = await launchImageLibraryAsync({ mediaTypes: ['images'], exif: false })
  return result.canceled ? null : preparePhoto(result.assets[0])
}

function allowNavigation(url: string, updateDocument?: string) {
  if (url.startsWith('file:')) return allowsLocalDocument(url, updateDocument)
  if (!__DEV__ || !/^https?:\/\//.test(url)) return false
  const page = new URL(url)
  return page.pathname === '/_expo/@dom/DomApp.tsx' &&
    (page.searchParams.get('file')?.endsWith('/src/expo/DomApp.tsx') ?? false)
}

export default function NativeApp() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [incomingLink, setIncomingLink] = useState({ url: '', sequence: 0 })
  const [canGoBack, setCanGoBack] = useState(false)
  const [backRequest, setBackRequest] = useState(0)
  const [foregroundSequence, setForegroundSequence] = useState(0)
  const [updateDocument] = useState(getUpdateDocument)
  const [previewLoad, setPreviewLoad] = useState<'loading' | 'ready' | 'error'>('loading')
  const [previewAttempt, setPreviewAttempt] = useState(0)

  useEffect(() => {
    if (!isPublishedPreview || previewLoad !== 'loading') return
    const timeout = setTimeout(() => setPreviewLoad('error'), 20000)
    return () => clearTimeout(timeout)
  }, [previewAttempt, previewLoad])

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
      <SafeAreaView style={{ flex: 1, backgroundColor: theme === 'dark' ? '#111115' : '#f8faf3' }}>
        <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
        <DomApp
          key={previewAttempt}
          isExpoGo={isExpoGo}
          foregroundSequence={foregroundSequence}
          dom={{
            style: { flex: 1 },
            useExpoDOMWebView: false,
            allowUniversalAccessFromFileURLs: Platform.OS === 'android',
            contentInsetAdjustmentBehavior: 'never',
            overrideUri: updateDocument,
            onShouldStartLoadWithRequest: ({ url }) => allowNavigation(url, updateDocument),
            onError: isPublishedPreview ? () => setPreviewLoad('error') : undefined,
          }}
          incomingUrl={incomingLink.url}
          incomingSequence={incomingLink.sequence}
          backRequest={backRequest}
          setCanGoBack={async (value) => setCanGoBack(value)}
          onDomReady={isPublishedPreview ? async () => setPreviewLoad('ready') : undefined}
          setTheme={async (value) => setTheme(value)}
          openAuth={openAuth}
          openLink={openLink}
          shareText={shareText}
          copyText={copyText}
          exportJson={exportJson}
          vibrate={vibrate}
          takePhoto={takePhoto}
          pickPhoto={pickPhoto}
        />
        {isPublishedPreview && previewLoad !== 'ready' && (
          <View style={styles.previewStatus}>
            {previewLoad === 'loading' && <Text style={styles.brand}>Hebbian</Text>}
            {previewLoad === 'loading' && <ActivityIndicator size="small" color="#CBFC55" />}
            <Text style={styles.statusText} accessibilityLiveRegion="polite">
              {previewLoad === 'loading' ? 'Carregando o Hebbian…' : 'Não foi possível abrir o Hebbian.'}
            </Text>
            {previewLoad === 'error' && (
              <Button title="Tentar novamente" onPress={() => {
                setPreviewLoad('loading')
                setPreviewAttempt((attempt) => attempt + 1)
              }} />
            )}
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  previewStatus: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#111115',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  brand: { color: '#fff', fontSize: 34, fontWeight: '700' },
  statusText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
})
