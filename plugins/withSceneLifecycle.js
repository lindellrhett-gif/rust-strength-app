// iOS 27 requires apps built with its SDK (Xcode 27) to use the scene life cycle: an app that doesn't stops at
// launch with UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption. Expo SDK 57 ships the pieces
// (ExpoAppSceneDelegate, ExpoReactNativeFactoryProvider) but its project template still starts React Native from
// the app delegate. This plugin switches the generated project over:
//   - AppDelegate conforms to ExpoReactNativeFactoryProvider and no longer creates the window itself,
//   - SceneDelegate (Expo's ExpoAppSceneDelegate) creates the window and starts React Native,
//   - Info.plist declares the scene configuration.
// Builds with older Xcode versions (EAS servers) work the same way. Remove this plugin once Expo's template does it.
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const WINDOW_BLOCK = /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/;

function withSceneAppDelegate(config) {
  return withAppDelegate(config, (cfg) => {
    if (cfg.modResults.language !== 'swift') {
      throw new Error('withSceneLifecycle: expected a Swift AppDelegate');
    }
    let src = cfg.modResults.contents;
    if (src.includes('class SceneDelegate')) return cfg;

    const header = 'class AppDelegate: ExpoAppDelegate {';
    if (!src.includes(header) || !WINDOW_BLOCK.test(src)) {
      // Fail the build rather than ship an app that crashes on launch.
      throw new Error('withSceneLifecycle: the AppDelegate template changed; update plugins/withSceneLifecycle.js');
    }
    src = src.replace(header, 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {');
    // The scene delegate creates the window and starts React Native into it.
    src = src.replace(WINDOW_BLOCK, '\n');
    src +=
      '\n// Creates the window and starts React Native for each scene (required by iOS 27, see\n' +
      '// plugins/withSceneLifecycle.js).\n' +
      'class SceneDelegate: ExpoAppSceneDelegate {}\n';
    cfg.modResults.contents = src;
    return cfg;
  });
}

function withSceneManifest(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });
}

module.exports = function withSceneLifecycle(config) {
  return withSceneManifest(withSceneAppDelegate(config));
};
