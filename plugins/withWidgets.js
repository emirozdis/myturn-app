// ./plugins/withWidgets.js
const { withAndroidManifest } = require('@expo/config-plugins');

const withWidgets = (config) => {
  // Configures the Android Manifest to register the Glance receiver
  // The iOS configuration is now entirely handled by the official `expo-widgets` plugin in app.json.
  config = withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application[0];
    if (!mainApplication.receiver) {
      mainApplication.receiver = [];
    }
    
    mainApplication.receiver.push({
      $: {
        'android:name': '.widgets.TodayVloggerWidgetReceiver',
        'android:exported': 'true',
      },
      'intent-filter': [
        {
          action: [
            { $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }
          ]
        }
      ],
      'meta-data': [
        {
          $: {
            'android:name': 'android.appwidget.provider',
            'android:resource': '@xml/today_vlogger_widget_info'
          }
        }
      ]
    });
    
    return config;
  });

  return config;
};

module.exports = withWidgets;