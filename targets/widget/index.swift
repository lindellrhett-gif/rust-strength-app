import SwiftUI
import WidgetKit

/// The widget extension. It holds only Live Activities, a run in progress and
/// the rest between sets: there are no Home Screen widgets.
@main
struct RustStrengthWidgets: WidgetBundle {
  var body: some Widget {
    RunLiveActivity()
    RestLiveActivity()
  }
}
