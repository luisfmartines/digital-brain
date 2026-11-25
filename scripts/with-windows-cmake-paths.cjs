const { withAppBuildGradle } = require('expo/config-plugins')

module.exports = function withWindowsCmakePaths(config) {
  return withAppBuildGradle(config, (config) => {
    const gradle = config.modResults
    if (gradle.contents.includes('CMAKE_OBJECT_PATH_MAX')) return config

    const defaultConfig = /^([ \t]*)defaultConfig\s*\{/m
    if (gradle.language !== 'groovy' || !defaultConfig.test(gradle.contents)) {
      throw new Error('The Android app Gradle template has no Groovy defaultConfig block.')
    }

    gradle.contents = gradle.contents.replace(defaultConfig, `$&
        // Shorten codegen object names before Windows Ninja hits its path limit.
        if (System.getProperty('os.name').startsWith('Windows')) {
            externalNativeBuild {
                cmake {
                    arguments '-DCMAKE_OBJECT_PATH_MAX=240'
                }
            }
        }`)
    return config
  })
}
