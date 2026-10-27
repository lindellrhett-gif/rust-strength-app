import ActivityKit
import SwiftUI
import WidgetKit

/// The rest between sets on the Lock Screen and in the Dynamic Island: a
/// countdown with a bar, and the next set.
///
/// iOS runs the countdown itself. The app is usually asleep while you rest,
/// so it can't say when the time is up; instead the activity goes stale at
/// the end of the rest, and from then on it shows "Rest's up" on its own.
struct RestLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: RestActivityAttributes.self) { context in
      RestLockScreenView(state: context.state, isOver: restIsOver(context))
        .activityBackgroundTint(Palette.surface)
        .activitySystemActionForegroundColor(Palette.text)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          RestCountdown(state: context.state, isOver: restIsOver(context))
            .font(.system(.title, design: .rounded).weight(.bold).monospacedDigit())
            .foregroundStyle(restIsOver(context) ? Palette.success : Palette.text)
            .padding(.leading, 4)
        }
        DynamicIslandExpandedRegion(.trailing) {
          NextSetView(state: context.state, alignment: .trailing)
            .padding(.trailing, 4)
        }
        DynamicIslandExpandedRegion(.bottom) {
          RestBar(state: context.state, isOver: restIsOver(context))
            .padding(.horizontal, 4)
        }
      } compactLeading: {
        Image(systemName: "timer")
          .foregroundStyle(restIsOver(context) ? Palette.success : Palette.accent)
      } compactTrailing: {
        RestCountdown(state: context.state, isOver: restIsOver(context))
          .font(.body.weight(.semibold).monospacedDigit())
          .foregroundStyle(restIsOver(context) ? Palette.success : Palette.text)
          .multilineTextAlignment(.trailing)
          .frame(maxWidth: 52, alignment: .trailing)
      } minimal: {
        Image(systemName: "timer")
          .foregroundStyle(restIsOver(context) ? Palette.success : Palette.accent)
      }
      .keylineTint(Palette.accent)
    }
  }
}

/// Over once the app says so, or once the rest's end has passed without it.
private func restIsOver(_ context: ActivityViewContext<RestActivityAttributes>) -> Bool {
  context.isStale || context.state.status == "ready" || context.state.endsAt <= Date()
}

private struct RestLockScreenView: View {
  let state: RestActivityAttributes.ContentState
  let isOver: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(spacing: 6) {
        Image(systemName: "timer")
          .foregroundStyle(isOver ? Palette.success : Palette.accent)
        Text("Rest")
          .font(.subheadline.weight(.semibold))
          .foregroundStyle(Palette.text)
        Spacer()
        Text(isOver ? "Rest's up" : "Resting")
          .font(.caption.weight(.semibold))
          .foregroundStyle(isOver ? Palette.success : Palette.muted)
      }
      HStack(alignment: .center, spacing: 12) {
        RestCountdown(state: state, isOver: isOver)
          .font(.system(size: 40, weight: .bold, design: .rounded).monospacedDigit())
          .foregroundStyle(isOver ? Palette.success : Palette.text)
          .lineLimit(1)
          .minimumScaleFactor(0.7)
          .frame(minWidth: 96, alignment: .leading)
        Spacer(minLength: 8)
        NextSetView(state: state, alignment: .trailing)
      }
      RestBar(state: state, isOver: isOver)
    }
    .padding(16)
  }
}

/// The time left, counted down by iOS, or "Go" once it's over.
private struct RestCountdown: View {
  let state: RestActivityAttributes.ContentState
  let isOver: Bool

  var body: some View {
    if isOver {
      Text("Go")
    } else {
      Text(timerInterval: state.startedAt...state.endsAt, countsDown: true)
    }
  }
}

/// A bar that empties as the rest runs out.
private struct RestBar: View {
  let state: RestActivityAttributes.ContentState
  let isOver: Bool

  var body: some View {
    if isOver {
      ProgressView(value: 1)
        .tint(Palette.success)
    } else {
      ProgressView(timerInterval: state.startedAt...state.endsAt, countsDown: true) {
        EmptyView()
      } currentValueLabel: {
        EmptyView()
      }
      .tint(Palette.accent)
    }
  }
}

/// "NEXT SET / Bench Press / 185 lb × 6–8", when the app knows it.
private struct NextSetView: View {
  let state: RestActivityAttributes.ContentState
  let alignment: HorizontalAlignment

  var body: some View {
    if state.exercise.isEmpty && state.detail.isEmpty {
      EmptyView()
    } else {
      VStack(alignment: alignment, spacing: 2) {
        Text(state.label.uppercased())
          .font(.caption2.weight(.semibold))
          .foregroundStyle(Palette.muted)
        if !state.exercise.isEmpty {
          Text(state.exercise)
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(Palette.text)
            .lineLimit(1)
        }
        if !state.detail.isEmpty {
          Text(state.detail)
            .font(.subheadline.monospacedDigit())
            .foregroundStyle(Palette.text)
            .lineLimit(1)
        }
      }
    }
  }
}
