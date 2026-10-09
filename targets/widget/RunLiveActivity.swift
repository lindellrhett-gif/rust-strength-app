import ActivityKit
import SwiftUI
import WidgetKit

/// A run in progress on the Lock Screen and in the Dynamic Island: the
/// moving time, distance and average pace, as on the recording screen.
///
/// iOS draws the clock itself from `clockStart`, so it ticks every second
/// without the app sending anything. While the clock is still (counting
/// down, paused, or held at a stop) the time is shown as sent. If updates
/// stop arriving, for example because the app was closed mid-run, the
/// activity goes stale and says so instead of counting on.
struct RunLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: RunActivityAttributes.self) { context in
      LockScreenView(state: context.state, isStale: context.isStale)
        .activityBackgroundTint(Palette.surface)
        .activitySystemActionForegroundColor(Palette.text)
        .widgetURL(URL(string: context.attributes.deepLink))
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Stat(value: context.state.distance, label: context.state.unit.uppercased(), alignment: .leading)
            .padding(.leading, 4)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Stat(value: context.state.pace, label: "AVG /\(context.state.unit.uppercased())", alignment: .trailing)
            .padding(.trailing, 4)
        }
        DynamicIslandExpandedRegion(.center) {
          RunClock(state: context.state, isStale: context.isStale)
            .font(.system(.title2, design: .rounded).weight(.bold).monospacedDigit())
            .foregroundStyle(Palette.text)
        }
        DynamicIslandExpandedRegion(.bottom) {
          StatusLabel(state: context.state, isStale: context.isStale)
        }
      } compactLeading: {
        Image(systemName: "figure.run")
          .foregroundStyle(Palette.tint(for: context.state, isStale: context.isStale))
      } compactTrailing: {
        RunClock(state: context.state, isStale: context.isStale)
          .font(.body.weight(.semibold).monospacedDigit())
          .foregroundStyle(Palette.text)
          .multilineTextAlignment(.trailing)
          .frame(maxWidth: 64, alignment: .trailing)
      } minimal: {
        Image(systemName: "figure.run")
          .foregroundStyle(Palette.tint(for: context.state, isStale: context.isStale))
      }
      .widgetURL(URL(string: context.attributes.deepLink))
      .keylineTint(Palette.accent)
    }
  }
}

private struct LockScreenView: View {
  let state: RunActivityAttributes.ContentState
  let isStale: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(spacing: 6) {
        Image(systemName: "figure.run")
          .foregroundStyle(Palette.tint(for: state, isStale: isStale))
        Text("Run")
          .font(.subheadline.weight(.semibold))
          .foregroundStyle(Palette.text)
        Spacer()
        StatusLabel(state: state, isStale: isStale)
      }
      HStack(alignment: .lastTextBaseline) {
        VStack(alignment: .leading, spacing: 2) {
          RunClock(state: state, isStale: isStale)
            .font(.system(size: 34, weight: .bold, design: .rounded).monospacedDigit())
            .foregroundStyle(Palette.text)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
          Text("TIME")
            .font(.caption2.weight(.semibold))
            .foregroundStyle(Palette.muted)
        }
        Spacer(minLength: 12)
        Stat(value: state.distance, label: state.unit.uppercased(), alignment: .trailing)
        Spacer(minLength: 12)
        Stat(value: state.pace, label: "AVG /\(state.unit.uppercased())", alignment: .trailing)
      }
    }
    .padding(16)
  }
}

/// The moving time: ticking from `clockStart`, or as sent while it is still.
private struct RunClock: View {
  let state: RunActivityAttributes.ContentState
  let isStale: Bool

  var body: some View {
    if let start = state.clockStart, !isStale {
      // The upper bound only has to be later than any run can last.
      Text(timerInterval: start...start.addingTimeInterval(48 * 3600), countsDown: false)
    } else {
      Text(state.time)
    }
  }
}

private struct Stat: View {
  let value: String
  let label: String
  let alignment: HorizontalAlignment

  var body: some View {
    VStack(alignment: alignment, spacing: 2) {
      Text(value)
        .font(.title3.weight(.semibold).monospacedDigit())
        .foregroundStyle(Palette.text)
        .lineLimit(1)
      Text(label)
        .font(.caption2.weight(.semibold))
        .foregroundStyle(Palette.muted)
    }
  }
}

private struct StatusLabel: View {
  let state: RunActivityAttributes.ContentState
  let isStale: Bool

  var body: some View {
    Text(text)
      .font(.caption.weight(.semibold))
      .foregroundStyle(Palette.tint(for: state, isStale: isStale))
      .lineLimit(1)
  }

  private var text: String {
    if isStale { return "Not updating. Open the app" }
    switch state.status {
    case "starting": return "Starting"
    case "paused": return "Paused"
    case "auto-paused": return "Auto-paused"
    default: return "Recording"
    }
  }
}

/// The app's colours (src/theme/colors.ts).
private enum Palette {
  static let surface = Color(hex: 0x14181D)
  static let text = Color(hex: 0xF2F5F8)
  static let muted = Color(hex: 0x9AA7B4)
  static let accent = Color(hex: 0x4F8CFF)
  static let warning = Color(hex: 0xF5B14C)

  static func tint(for state: RunActivityAttributes.ContentState, isStale: Bool) -> Color {
    if isStale || state.status == "starting" { return muted }
    return state.status == "recording" ? accent : warning
  }
}

private extension Color {
  init(hex: UInt32) {
    self.init(
      .sRGB,
      red: Double((hex >> 16) & 0xFF) / 255,
      green: Double((hex >> 8) & 0xFF) / 255,
      blue: Double(hex & 0xFF) / 255,
      opacity: 1
    )
  }
}
