const { withAndroidManifest, withMainActivity, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withAndroidCustomizations(config) {
  config = withAndroidManifest(config, async (config) => {
    let androidManifest = config.modResults;
    let mainApplication = androidManifest.manifest.application[0];

    if (!androidManifest.manifest['uses-permission']) {
      androidManifest.manifest['uses-permission'] = [];
    }
    
    const permissionsToAdd = [
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_SPECIAL_USE'
    ];

    permissionsToAdd.forEach(perm => {
      if (!androidManifest.manifest['uses-permission'].some(p => p.$['android:name'] === perm)) {
        androidManifest.manifest['uses-permission'].push({
          $: { 'android:name': perm }
        });
      }
    });

    if (!mainApplication.receiver) mainApplication.receiver = [];
    if (!mainApplication.receiver.some(r => r.$['android:name'] === '.BootReceiver')) {
      mainApplication.receiver.push({
        $: {
          'android:name': '.BootReceiver',
          'android:enabled': 'true',
          'android:exported': 'true'
        },
        'intent-filter': [
          {
            action: [{ $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } }],
            category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }]
          }
        ]
      });
    }

    if (!mainApplication.service) mainApplication.service = [];
    if (!mainApplication.service.some(s => s.$['android:name'] === '.GPSReceiverService')) {
      mainApplication.service.push({
        $: {
          'android:name': '.GPSReceiverService',
          'android:enabled': 'true',
          'android:exported': 'false',
          'android:foregroundServiceType': 'specialUse'
        }
      });
    }

    return config;
  });

  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const targetDir = path.join(projectRoot, 'android/app/src/main/java/com/anonymous/receiver');
      const sourceDir = path.join(projectRoot, 'native-custom');

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      fs.copyFileSync(
        path.join(sourceDir, 'BootReceiver.kt'),
        path.join(targetDir, 'BootReceiver.kt')
      );
      fs.copyFileSync(
        path.join(sourceDir, 'GPSReceiverService.kt'),
        path.join(targetDir, 'GPSReceiverService.kt')
      );

      return config;
    }
  ]);

  config = withMainActivity(config, async (config) => {
    let mainActivity = config.modResults;
    let contents = mainActivity.contents;

    if (!contents.includes('GPSReceiverService')) {
      const importBlock = 'import android.content.Intent';
      const serviceStartBlock = `
    val serviceIntent = Intent(this, GPSReceiverService::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        startForegroundService(serviceIntent)
    } else {
        startService(serviceIntent)
    }
      `;

      contents = contents.replace('class MainActivity : ReactActivity() {', `${importBlock}\nclass MainActivity : ReactActivity() {`);
      
      const insertIndex = contents.indexOf('super.onCreate(null)');
      if (insertIndex !== -1) {
        contents = contents.substring(0, insertIndex) + serviceStartBlock + contents.substring(insertIndex);
      }
      
      mainActivity.contents = contents;
    }

    return config;
  });

  return config;
};
