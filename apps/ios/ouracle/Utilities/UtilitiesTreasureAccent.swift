import SwiftUI
import Combine

// Cycles the accent color through jing → shen → qi → jing over 90 seconds,
// matching the CSS accent-breathe keyframes on the web.
@MainActor
final class TreasureAccent: ObservableObject {
    @Published private(set) var color: Color

    private var elapsed: Double = 0
    private var cancellable: AnyCancellable?

    init() {
        color = Self.color(at: 0)
        cancellable = Timer.publish(every: 0.5, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in self?.tick() }
    }

    private func tick() {
        elapsed += 0.5
        let t = elapsed.truncatingRemainder(dividingBy: 90) / 90
        color = Self.color(at: t)
    }

    // Keyframes: 0%=217°(jing), 33%=354°(shen), 66%=80°(qi), 100%=217°(jing)
    private static func color(at t: Double) -> Color {
        let degrees: Double
        if t < 1.0 / 3.0 {
            degrees = lerp(217, 354, t * 3)
        } else if t < 2.0 / 3.0 {
            degrees = lerp(354, 80, (t - 1.0 / 3.0) * 3)
        } else {
            degrees = lerp(80, 217, (t - 2.0 / 3.0) * 3)
        }
        let h = degrees / 360.0
        return Color(uiColor: UIColor(dynamicProvider: { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(hue: h, saturation: 0.62, brightness: 0.82, alpha: 1)
                : UIColor(hue: h, saturation: 0.75, brightness: 0.50, alpha: 1)
        }))
    }

    private static func lerp(_ a: Double, _ b: Double, _ t: Double) -> Double {
        a + (b - a) * t
    }
}
