import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { loadEnvFile } from 'node:process'

// Accept the existing deployment's public variables during the migration.
for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) loadEnvFile(file)
}
for (const key of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'EXERCISEDB_URL']) {
  const legacy = process.env[`VITE_${key}`]
  if (legacy) process.env[`EXPO_PUBLIC_${key}`] ??= legacy
}

const require = createRequire(import.meta.url)
const cli = require.resolve('expo/bin/cli')
const args = process.argv.slice(2)
if (args[0] === 'export' && (args.includes('android') || args.includes('ios'))) {
  // Expo SDK 58 can reference an absent shared chunk when exporting a DOM root.
  process.env.EXPO_NO_BUNDLE_SPLITTING ??= '1'
}
const child = spawn(process.execPath, [cli, ...args], { stdio: 'inherit' })
child.on('exit', (code) => { process.exitCode = code ?? 1 })
