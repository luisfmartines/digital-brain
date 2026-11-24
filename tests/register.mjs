// Resolve the app's extensionless TypeScript imports for Node's built-in test runner.
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && context.parentURL) {
      const url = new URL(`${specifier}.ts`, context.parentURL)
      if (existsSync(fileURLToPath(url))) return nextResolve(url.href, context)
    }
    return nextResolve(specifier, context)
  },
})
