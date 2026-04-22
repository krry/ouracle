import SwiftUI

// MARK: - Composed nebula (gradient blobs + particle motes)

struct NebulaView: View {
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        ZStack {
            NebulaGradientLayer()
            NebulaParticleView()
                .opacity(colorScheme == .dark ? 1 : 0.35)
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }
}

// MARK: - Layer 1: TimelineView gradient blobs

struct NebulaGradientLayer: View {
    @Environment(\.colorScheme) private var colorScheme

    // hue (0–1), drift period (s), initial phase offset (radians)
    // Periods are prime numbers so blobs never align simultaneously.
    private let blobs: [(hue: Double, period: Double, phase: Double)] = [
        (217 / 360, 31, 0),           // jing
        (354 / 360, 41, 2.094),       // shen
        ( 80 / 360, 53, 4.189),       // qi
    ]

    var body: some View {
        TimelineView(.animation) { ctx in
            let t = ctx.date.timeIntervalSinceReferenceDate
            GeometryReader { geo in
                ZStack {
                    ForEach(0..<3, id: \.self) { i in
                        blobView(t: t, blob: blobs[i], size: geo.size)
                    }
                }
                // Heavy blur gives the amorphous, cloud-like edge
                .blur(radius: min(geo.size.width, geo.size.height) * 0.24)
                .blendMode(colorScheme == .dark ? .screen : .normal)
                .opacity(colorScheme == .dark ? 0.58 : 0.22)
            }
        }
    }

    private func blobView(
        t: Double,
        blob: (hue: Double, period: Double, phase: Double),
        size: CGSize
    ) -> some View {
        let θ = t / blob.period * .pi * 2 + blob.phase
        // Irrational harmonics (φ=1.618, √2≈1.414, 1/√3≈0.577) ensure
        // motion never visibly repeats within a human-observable timeframe.
        let xFrac  = sin(θ) * 0.22 + sin(θ * 1.618) * 0.10
        let yFrac  = cos(θ * 0.737) * 0.18 + cos(θ * 2.414) * 0.09
        let scale  = 0.55 + sin(θ * 0.577) * 0.14 + sin(θ * 1.303) * 0.07
        let r      = max(size.width, size.height) * 0.45 * scale
        let sat    = colorScheme == .dark ? 0.78 : 0.65
        let bright = colorScheme == .dark ? 0.95 : 0.80

        return Rectangle()
            .fill(RadialGradient(
                colors: [
                    Color(hue: blob.hue, saturation: sat,        brightness: bright, opacity: 1.0),
                    Color(hue: blob.hue, saturation: sat * 0.70, brightness: 0.55,   opacity: 0.55),
                    .clear,
                ],
                center: .center,
                startRadius: 0,
                endRadius: r
            ))
            .frame(width: r * 2, height: r * 2)
            .offset(x: size.width * xFrac, y: size.height * yFrac)
            .rotationEffect(.degrees(θ * 11))
    }
}

#Preview {
    NebulaView()
        .background(Color.black)
}
