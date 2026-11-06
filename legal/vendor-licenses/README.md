# Licences of native libraries that don't come from npm

`scripts/build-notices.js` lists every npm package in the app's JavaScript
bundle from the package itself. A few native iOS libraries are pulled in by
CocoaPods instead, so their licence files are kept here. Fetched October 29,
2026 from each project's repository:

| File | Library | From |
| --- | --- | --- |
| `purchases-ios.LICENSE` | RevenueCat and RevenueCatUI (pulled in by `react-native-purchases`) | https://github.com/RevenueCat/purchases-ios |
| `purchases-hybrid-common.LICENSE` | PurchasesHybridCommon and PurchasesHybridCommonUI 19.14.1 | https://github.com/RevenueCat/purchases-hybrid-common |
| `zxingify-objc.COPYING`, `zxingify-objc.NOTICE` | ZXingObjC (pulled in by `expo-camera` for barcode scanning) | https://github.com/zxingify/zxingify-objc |

When a native dependency changes (a new `react-native-purchases`, say), check
these and update the list in `scripts/build-notices.js`.
