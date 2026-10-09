import ActivityKit
import Foundation

/// What a run's Live Activity carries.
///
/// The app (modules/run-activity) and the widget that draws the activity
/// (targets/widget) each have a copy of this file, and iOS matches the two by
/// this type's name, so the copies must stay identical. A Jest test
/// (__tests__/runningLiveActivity.test.ts) fails if they differ.
///
/// The values are decided and formatted in JavaScript
/// (src/domain/running/liveActivity.ts), so the Lock Screen always shows
/// exactly what the recording screen shows.
struct RunActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    /// "starting", "recording", "paused" or "auto-paused".
    var status: String
    /// When the moving clock read 0:00, while it is running. Nil while it is still.
    var clockStart: Date?
    /// The moving time, shown as it is while the clock is still: "32:15".
    var time: String
    /// "3.12"
    var distance: String
    /// Average pace: "8:05", or "--:--".
    var pace: String
    /// "mi" or "km".
    var unit: String
  }

  /// Opens the recording screen when the activity is tapped.
  var deepLink: String
}
