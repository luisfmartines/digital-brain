import { createClient } from '@supabase/supabase-js'
import { IS_DOM } from 'expo/dom'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

export const supabase = createClient(
  supabaseUrl,
  publishableKey,
  IS_DOM ? { auth: { flowType: 'pkce', detectSessionInUrl: false } } : undefined,
)

// Expo Go sends email links to the existing web app, which completes them in its browser.
export function createBrowserEmailAuth() {
  return createClient(supabaseUrl, publishableKey, {
    auth: {
      flowType: 'implicit',
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
      storageKey: 'digital-brain-browser-email',
    },
  }).auth
}
