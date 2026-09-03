const fs = require('fs');
const path = require('path');
const {
  AndroidConfig,
  withAndroidManifest,
  withAppDelegate,
  withDangerousMod,
} = require('@expo/config-plugins');

const withFirebaseConfigure = (config) => {
  config = withAndroidManifest(config, (config) => {
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(
      config.modResults,
    );
    const analyticsOverrides = [
      'firebase_analytics_collection_enabled',
      'google_analytics_adid_collection_enabled',
      'google_analytics_default_allow_ad_personalization_signals',
    ];

    config.modResults.manifest.$ = {
      ...config.modResults.manifest.$,
      'xmlns:tools': 'http://schemas.android.com/tools',
    };

    for (const name of analyticsOverrides) {
      AndroidConfig.Manifest.addMetaDataItemToMainApplication(
        mainApplication,
        name,
        'false',
      );

      const item = mainApplication['meta-data']?.find(
        (entry) => entry.$['android:name'] === name,
      );
      if (item) {
        item.$['tools:replace'] = 'android:value';
      }
    }

    return config;
  });

  config = withAppDelegate(config, (config) => {
    let contents = config.modResults.contents;

    if (config.modResults.language === 'swift') {
      if (!contents.includes('import FirebaseCore')) {
        contents = contents.replace(/(import ReactAppDependencyProvider\n)/, '$1import FirebaseCore\n');
      }
      if (!contents.includes('RNFBAppCheckModule.sharedInstance()')) {
        const firebaseConfigure = contents.includes('FirebaseApp.configure()')
          ? ''
          : '    FirebaseApp.configure()\n';
        contents = contents.replace(
          /let delegate = ReactNativeDelegate\(\)/,
          `RNFBAppCheckModule.sharedInstance()\n${firebaseConfigure}    let delegate = ReactNativeDelegate()`
        );
      }
    } else if (config.modResults.language === 'objc' || config.modResults.language === 'objcpp') {
      if (!contents.includes('#import <RNFBAppCheckModule.h>')) {
        contents = contents.replace(
          /#import "AppDelegate.h"/,
          '#import "AppDelegate.h"\n#import <RNFBAppCheckModule.h>'
        );
      }
      if (!contents.includes('[RNFBAppCheckModule sharedInstance];')) {
        contents = contents.replace(
          /(- \(BOOL\)application:[\s\S]*?didFinishLaunchingWithOptions:[^{]*\{)/,
          '$1\n  [RNFBAppCheckModule sharedInstance];'
        );
      }
    }

    config.modResults.contents = contents;
    return config;
  });

  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectName = config.modRequest.projectName;
      const headerPath = path.join(
        config.modRequest.platformProjectRoot,
        projectName,
        `${projectName}-Bridging-Header.h`,
      );

      if (fs.existsSync(headerPath)) {
        let contents = await fs.promises.readFile(headerPath, 'utf8');
        if (!contents.includes('#import <RNFBAppCheckModule.h>')) {
          contents = `${contents.trimEnd()}\n#import <RNFBAppCheckModule.h>\n`;
          await fs.promises.writeFile(headerPath, contents);
        }
      }

      return config;
    },
  ]);
};

module.exports = withFirebaseConfigure;
