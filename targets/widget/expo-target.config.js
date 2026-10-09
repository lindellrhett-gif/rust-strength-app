/**
 * The widget extension that draws a run's Live Activity on the Lock Screen
 * and in the Dynamic Island. @bacons/apple-targets adds it to the Xcode
 * project at prebuild, so it lives here rather than in a committed ios/
 * folder. Its bundle identifier is the app's plus ".widget", which EAS signs
 * as a separate app extension.
 *
 * @type {import('@bacons/apple-targets/app.plugin').ConfigFunction}
 */
module.exports = () => ({
  type: 'widget',
  displayName: 'Run',
  deploymentTarget: '16.4',
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit'],
  colors: {
    // src/theme/colors.ts: primary and surface.
    $accent: '#4F8CFF',
    $widgetBackground: '#14181D',
  },
});
