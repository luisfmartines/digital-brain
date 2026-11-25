import type { ConfigContext, ExpoConfig } from 'expo/config'

export default function configureApp({ config }: ConfigContext): ExpoConfig {
  if (process.env.DIGITAL_BRAIN_EXPO_GO_PREVIEW !== '1') return config

  const projectId = config.extra?.eas?.projectId
  if (typeof projectId !== 'string') {
    throw new Error('Vincule o projeto à Expo antes de preparar a prévia compartilhável.')
  }

  return {
    ...config,
    runtimeVersion: { policy: 'sdkVersion' },
    updates: { url: `https://u.expo.dev/${projectId}` },
  }
}
