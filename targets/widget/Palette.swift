import SwiftUI

/// The app's colours (src/theme/colors.ts), shared by the Live Activities.
enum Palette {
  static let surface = Color(hex: 0x14181D)
  static let text = Color(hex: 0xF2F5F8)
  static let muted = Color(hex: 0x9AA7B4)
  static let accent = Color(hex: 0x4F8CFF)
  static let warning = Color(hex: 0xF5B14C)
  static let success = Color(hex: 0x3ECF8E)
}

extension Color {
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
