import { createClient } from '@supabase/supabase-js'
import { IS_DOM } from 'expo/dom'

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  IS_DOM ? { auth: { flowType: 'pkce', detectSessionInUrl: false } } : undefined,
)
