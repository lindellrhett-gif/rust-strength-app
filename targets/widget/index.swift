import SwiftUI
import WidgetKit

/// The widget extension. It holds only the run's Live Activity: there are no
/// Home Screen widgets.
@main
struct RustStrengthWidgets: WidgetBundle {
  var body: some Widget {
    RunLiveActivity()
  }
}
