import ActivityKit
import Foundation

/// What the rest timer's Live Activity carries.
///
/// The app (modules/live-activities) and the widget that draws the activity
/// (targets/widget) each have a copy of this file, and iOS matches the two by
/// this type's name, so the copies must stay identical. A Jest test
/// (__tests__/restActivity.test.ts) fails if they differ.
///
/// The values are decided and formatted in JavaScript
/// (src/domain/restActivity.ts).
struct RestActivityAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    /// "resting", or "ready" once the rest is over.
    var status: String
    /// When the rest began and ends, for the countdown and its bar.
    var startedAt: Date
    var endsAt: Date
    /// The exercise of the next set: "Bench Press". Empty when unknown.
    var exercise: String
    /// "Next set", or "Last set" when only the one just logged is known.
    var label: String
    /// "185 lb × 6–8". Empty when unknown.
    var detail: String
  }
}
