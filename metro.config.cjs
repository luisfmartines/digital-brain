const { getDefaultConfig } = require('expo/metro-config')

// Native build scripts call Expo directly. Keep each embedded DOM export in
// one JavaScript file to avoid Expo SDK 58's shared-chunk resolution issue.
if (process.argv.includes('export:embed')) {
  process.env.EXPO_NO_BUNDLE_SPLITTING ??= '1'
}

module.exports = getDefaultConfig(__dirname)
