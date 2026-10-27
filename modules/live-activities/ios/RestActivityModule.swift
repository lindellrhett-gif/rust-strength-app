import ActivityKit
import ExpoModulesCore

/// The rest timer between sets on the Lock Screen and in the Dynamic Island,
/// with the next set.
///
/// What to show is decided in JavaScript (src/domain/restActivity.ts and
/// src/lib/restActivity.ts); this only hands it to ActivityKit. The app is
/// usually asleep while you rest, so it can't send an update when the time
/// is up. Instead each update says the content goes stale when the rest
/// ends, and the widget shows "Rest's up" from then on by itself. Nothing
/// here talks to a server: there is no push token.
public class RestActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RestActivity")

    /// Shows the rest, or updates the one already showing. iOS only lets an
    /// app start an activity while it is open, which it is when a set is
    /// logged.
    AsyncFunction("start") { (state: RestActivityStateRecord) -> Bool in
      let content = state.content()
      let existing = Activity<RestActivityAttributes>.activities
      if let current = existing.first {
        for extra in existing.dropFirst() {
          await extra.end(nil, dismissalPolicy: .immediate)
        }
        await current.update(content)
        return true
      }
      guard ActivityAuthorizationInfo().areActivitiesEnabled else {
        return false
      }
      _ = try Activity<RestActivityAttributes>.request(
        attributes: RestActivityAttributes(),
        content: content,
        pushType: nil
      )
      return true
    }

    /// Takes the rest off the Lock Screen straight away.
    AsyncFunction("end") { () in
      for activity in Activity<RestActivityAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
    }
  }
}

/// A RestActivityState from JavaScript.
struct RestActivityStateRecord: Record {
  @Field var status: String = "resting"
  /// Epoch milliseconds.
  @Field var startedAt: Double = 0
  @Field var endsAt: Double = 0
  @Field var exercise: String = ""
  @Field var label: String = "Next set"
  @Field var detail: String = ""

  func content() -> ActivityContent<RestActivityAttributes.ContentState> {
    let ends = Date(timeIntervalSince1970: endsAt / 1000)
    // A countdown's start can never be after its end.
    let started = min(Date(timeIntervalSince1970: startedAt / 1000), ends)
    let state = RestActivityAttributes.ContentState(
      status: status,
      startedAt: started,
      endsAt: ends,
      exercise: exercise,
      label: label,
      detail: detail
    )
    // Stale the moment the rest is over, so the widget switches to "Rest's
    // up" without the app having to wake up.
    return ActivityContent(state: state, staleDate: status == "resting" ? ends : nil)
  }
}
