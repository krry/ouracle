import SwiftUI
import SpriteKit

// MARK: - SwiftUI wrapper

struct NebulaParticleView: View {
    // Scene is created once; SpriteView retains it for the view's lifetime.
    @State private var scene: NebulaScene = {
        let s = NebulaScene()
        s.scaleMode = .resizeFill
        s.backgroundColor = .clear
        return s
    }()

    var body: some View {
        SpriteView(scene: scene, options: [.allowsTransparency])
            .ignoresSafeArea()
            .allowsHitTesting(false)
    }
}

// MARK: - SpriteKit scene

final class NebulaScene: SKScene {

    // Soft radial glow — built once, shared by all emitter types.
    private static let glowTexture: SKTexture = {
        let sz: CGFloat = 64
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: sz, height: sz))
        let img = renderer.image { ctx in
            let c = CGPoint(x: sz / 2, y: sz / 2)
            let colors = [UIColor.white.cgColor, UIColor.clear.cgColor] as CFArray
            let space = CGColorSpaceCreateDeviceRGB()
            guard let gradient = CGGradient(
                colorsSpace: space, colors: colors, locations: [0.0, 1.0]
            ) else { return }
            ctx.cgContext.drawRadialGradient(
                gradient,
                startCenter: c, startRadius: 0,
                endCenter: c, endRadius: sz / 2,
                options: []
            )
        }
        return SKTexture(image: img)
    }()

    override func didMove(to view: SKView) {
        backgroundColor = .clear
        let center = CGPoint(x: size.width / 2, y: size.height / 2)
        let spread = CGVector(dx: size.width, dy: size.height)

        for emitter in [motes(), faeries(), mist(), sparks()] {
            emitter.position = center
            emitter.particlePositionRange = spread
            addChild(emitter)
        }
    }

    // MARK: - Emitter definitions

    // Gentle drifting glows — large soft jing-blue spheres
    private func motes() -> SKEmitterNode {
        let e = SKEmitterNode()
        e.particleTexture          = Self.glowTexture
        e.particleColor            = UIColor(hue: 217/360, saturation: 0.60, brightness: 0.95, alpha: 1)
        e.particleColorBlendFactor = 1.0
        e.particleAlpha            = 0.38
        e.particleAlphaSpeed       = -0.032       // fades to ~0 over lifetime
        e.particleScale            = 0.45
        e.particleScaleRange       = 0.35
        e.particleLifetime         = 12
        e.particleLifetimeRange    = 6
        e.particleSpeed            = 18
        e.particleSpeedRange       = 14
        e.emissionAngleRange       = .pi * 2
        e.particleBirthRate        = 1.5
        e.particleBlendMode        = .add
        return e
    }

    // Tiny bright quick-movers — faerie lights
    private func faeries() -> SKEmitterNode {
        let e = SKEmitterNode()
        e.particleTexture          = Self.glowTexture
        e.particleColor            = UIColor(hue: 0.14, saturation: 0.25, brightness: 1.0, alpha: 1) // warm white
        e.particleColorBlendFactor = 1.0
        e.particleAlpha            = 0.80
        e.particleAlphaSpeed       = -0.16
        e.particleScale            = 0.10
        e.particleScaleRange       = 0.07
        e.particleLifetime         = 5
        e.particleLifetimeRange    = 3
        e.particleSpeed            = 55
        e.particleSpeedRange       = 40
        e.emissionAngleRange       = .pi * 2
        e.particleBirthRate        = 2.5
        e.particleBlendMode        = .add
        return e
    }

    // Huge barely-visible wisps — ambient mist
    private func mist() -> SKEmitterNode {
        let e = SKEmitterNode()
        e.particleTexture          = Self.glowTexture
        e.particleColor            = UIColor(white: 1.0, alpha: 1)
        e.particleColorBlendFactor = 0.4
        e.particleAlpha            = 0.06
        e.particleAlphaSpeed       = -0.0024
        e.particleScale            = 4.0
        e.particleScaleRange       = 2.5
        e.particleLifetime         = 25
        e.particleLifetimeRange    = 12
        e.particleSpeed            = 8
        e.particleSpeedRange       = 6
        e.emissionAngleRange       = .pi * 2
        e.particleBirthRate        = 0.3
        e.particleBlendMode        = .alpha
        return e
    }

    // Occasional bright sparks — upward-drifting, fast fade
    private func sparks() -> SKEmitterNode {
        let e = SKEmitterNode()
        e.particleTexture          = Self.glowTexture
        e.particleColor            = UIColor(hue: 0.09, saturation: 0.45, brightness: 1.0, alpha: 1) // warm gold
        e.particleColorBlendFactor = 1.0
        e.particleAlpha            = 0.90
        e.particleAlphaSpeed       = -0.65
        e.particleScale            = 0.07
        e.particleScaleRange       = 0.05
        e.particleLifetime         = 1.4
        e.particleLifetimeRange    = 1.0
        e.particleSpeed            = 130
        e.particleSpeedRange       = 90
        e.emissionAngle            = .pi / 2      // upward
        e.emissionAngleRange       = .pi / 2      // ±90° spread
        e.particleBirthRate        = 0.8
        e.particleBlendMode        = .add
        return e
    }
}
