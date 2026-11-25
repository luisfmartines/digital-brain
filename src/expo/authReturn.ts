import { supabase } from '../lib/supabase'
import { AUTH_REDIRECT } from './device'

export async function handleAuthReturn(url: URL) {
  if (`${url.protocol}//${url.host}` !== AUTH_REDIRECT) return
  const code = url.searchParams.get('code')
  if (!code) return
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) throw error
  return url.pathname === '/reset-password' ? '/reset-password' : '/'
}
