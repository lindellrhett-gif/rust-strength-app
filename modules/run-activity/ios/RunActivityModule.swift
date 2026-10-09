import ActivityKit
import ExpoModulesCore

/// The Live Activity that shows a run in progress on the Lock Screen and in
/// the Dynamic Island.
///
/// Every decision (what to show, and when an update is worth sending) is made
/// in JavaScript, in src/domain/running/liveActivity.ts and
/// src/lib/runActivity.ts. This only hands the result to ActivityKit. Nothing
/// here talks to a server: there is no push token, and the activity is
/// started, updated and ended by the app on the phone.
public class RunActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RunActivity")

    /// False when Live Activities are turned off for the app in Settings.
    Function("areEnabled") { () -> Bool in
      ActivityAuthorizationInfo().areActivitiesEnabled
    }

    /// Shows the run's activity, or takes over the one already showing (the
    /// app reloaded mid-run), ending any extras. iOS only lets an app start
    /// an activity while it is open, so this is called from the screen.
    AsyncFunction("start") { (state: RunActivityStateRecord, deepLink: String, staleAfterMs: Double) -> Bool in
      let content = state.content(staleAfterMs: staleAfterMs)
      let existing = Activity<RunActivityAttributes>.activities
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
      _ = try Activity<RunActivityAttributes>.request(
        attributes: RunActivityAttributes(deepLink: deepLink),
        content: content,
        pushType: nil
      )
      return true
    }

    /// Updates the activity, if one is showing. Works with the phone locked,
    /// while the app keeps running to record the route.
    AsyncFunction("update") { (state: RunActivityStateRecord, staleAfterMs: Double) -> Bool in
      let activities = Activity<RunActivityAttributes>.activities
      let content = state.content(staleAfterMs: staleAfterMs)
      for activity in activities {
        await activity.update(content)
      }
      return !activities.isEmpty
    }

    /// Takes the activity off the Lock Screen straight away.
    AsyncFunction("end") { () in
      for activity in Activity<RunActivityAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
    }
  }
}

/// A RunActivityState from JavaScript.
struct RunActivityStateRecord: Record {
  @Field var status: String = "recording"
  /// Epoch milliseconds, or nil while the clock is still.
  @Field var clockStart: Double? = nil
  @Field var time: String = "0:00"
  @Field var distance: String = "0.00"
  @Field var pace: String = "--:--"
  @Field var unit: String = "mi"

  func content(staleAfterMs: Double) -> ActivityContent<RunActivityAttributes.ContentState> {
    let state = RunActivityAttributes.ContentState(
      status: status,
      clockStart: clockStart.map { Date(timeIntervalSince1970: $0 / 1000) },
      time: time,
      distance: distance,
      pace: pace,
      unit: unit
    )
    return ActivityContent(state: state, staleDate: Date().addingTimeInterval(staleAfterMs / 1000))
  }
}
