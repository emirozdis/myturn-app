const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const SUPPORTED_ENVIRONMENTS = new Set([
  'development',
  'preview',
  'production',
]);

const LOCAL_ENV_FILES = {
  development: '.env.development',
  // Preview intentionally shares production services and credentials. Its
  // only runtime difference is the explicitly enabled App Check debug token.
  preview: '.env.production',
  production: '.env.production',
};

function configureDevelopmentCleartextTraffic(plugins, isDevelopment) {
  return (plugins || []).map((plugin) => {
    const pluginName = Array.isArray(plugin) ? plugin[0] : plugin;
    if (pluginName !== 'expo-build-properties') {
      return plugin;
    }

    const pluginOptions = Array.isArray(plugin) ? plugin[1] || {} : {};
    return [
      pluginName,
      {
        ...pluginOptions,
        android: {
          ...pluginOptions.android,
          // Local development uses an HTTP backend. Preview and production
          // remain HTTPS-only.
          usesCleartextTraffic: isDevelopment,
        },
      },
    ];
  });
}

module.exports = ({ config }) => {
  /*
   * Environment selection:
   *
   * Local commands:
   *   APP_ENV=development
   *   APP_ENV=production
   *
   * EAS builds:
   *   APP_ENV is supplied by eas.json
   *
   * Default:
   *   development
   */
  const appEnvironment =
    process.env.APP_ENV ||
    process.env.EXPO_PUBLIC_APP_ENV ||
    'development';

  if (!SUPPORTED_ENVIRONMENTS.has(appEnvironment)) {
    throw new Error(
      'APP_ENV must be development, preview, or production.',
    );
  }

  /*
   * Only local npm scripts set LOAD_LOCAL_ENV=true.
   *
   * This makes local commands load:
   *
   * .env.development
   * .env.production
   *
   * EAS builds get their public values from eas.json instead.
   */
  const shouldLoadLocalEnvironment =
    process.env.LOAD_LOCAL_ENV === 'true';

  if (shouldLoadLocalEnvironment) {
    const localEnvFile = LOCAL_ENV_FILES[appEnvironment];
    if (!localEnvFile) {
      throw new Error(
        `No local environment file is configured for ${appEnvironment}.`,
      );
    }

    const envFile = path.resolve(
      __dirname,
      localEnvFile,
    );

    if (!fs.existsSync(envFile)) {
      throw new Error(`Environment file not found: ${envFile}`);
    }

    /*
     * Parse the selected file manually so its values deterministically
     * replace old values from the current terminal session.
     */
    const parsedEnvironment = dotenv.parse(
      fs.readFileSync(envFile),
    );

    if (appEnvironment === 'preview') {
      const developmentEnvFile = path.resolve(
        __dirname,
        '.env.development',
      );
      if (!fs.existsSync(developmentEnvFile)) {
        throw new Error(
          `Preview App Check source not found: ${developmentEnvFile}`,
        );
      }

      const developmentEnvironment = dotenv.parse(
        fs.readFileSync(developmentEnvFile),
      );
      const previewDebugToken =
        developmentEnvironment.EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN?.trim();
      if (!previewDebugToken) {
        throw new Error(
          'EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN is required in .env.development for preview builds.',
        );
      }

      // Preview is an intentional mix: production services with only the
      // development App Check debug token overlaid.
      parsedEnvironment.EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN =
        previewDebugToken;
    }

    /*
     * Environment identity belongs in package.json scripts/eas.json,
     * not inside the actual .env files.
     */
    if (
      Object.prototype.hasOwnProperty.call(
        parsedEnvironment,
        'APP_ENV',
      ) ||
      Object.prototype.hasOwnProperty.call(
        parsedEnvironment,
        'EXPO_PUBLIC_APP_ENV',
      ) ||
      Object.prototype.hasOwnProperty.call(
        parsedEnvironment,
        'LOAD_LOCAL_ENV',
      )
    ) {
      throw new Error(
        'Do not put APP_ENV, EXPO_PUBLIC_APP_ENV, or LOAD_LOCAL_ENV inside .env files.',
      );
    }

    for (const [key, value] of Object.entries(parsedEnvironment)) {
      // A local production and preview build may share .env.production, but
      // the debug token must never be embedded into the production build.
      if (
        appEnvironment === 'production'
        && key === 'EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN'
      ) {
        continue;
      }
      process.env[key] = value;
    }

    if (appEnvironment === 'production') {
      delete process.env.EXPO_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN;
    }

    console.log(
      appEnvironment === 'preview'
        ? 'Loaded local preview environment: .env.production + App Check debug token from .env.development'
        : `Loaded local environment: ${localEnvFile}`,
    );
  }

  /*
   * Preview is a production-runtime build with debug attestation. Keeping the
   * runtime environment set to production means it uses the production API,
   * version requirements, survey targeting, diagnostics, and RevenueCat mode.
   */
  process.env.EXPO_PUBLIC_APP_ENV =
    appEnvironment === 'preview' ? 'production' : appEnvironment;
  process.env.EXPO_PUBLIC_BUILD_PROFILE = appEnvironment;

  /*
   * Development clients use the APNs development environment.
   *
   * Preview, TestFlight, Ad Hoc distribution and production builds use
   * the APNs production environment.
   */
  const usesProductionPushEnvironment =
    appEnvironment !== 'development';

  return {
    ...config,

    plugins: configureDevelopmentCleartextTraffic(
      config.plugins,
      appEnvironment === 'development',
    ),

    ios: {
      ...config.ios,

      googleServicesFile:
        process.env.GOOGLE_SERVICES_PLIST ||
        './GoogleService-Info.plist',

      entitlements: {
        ...config.ios?.entitlements,

        'aps-environment': usesProductionPushEnvironment
          ? 'production'
          : 'development',
        'com.apple.developer.devicecheck.appattest-environment':
          appEnvironment === 'development' ? 'development' : 'production',
      },
    },

    android: {
      ...config.android,

      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON ||
        './google-services.json',
    },
  };
};
