//
//  DesignTokens.swift
//  souvenir
//
//  Phase 13: Liquid Glass Design System
//  Centralized design constants for consistent styling
//

import SwiftUI
import CoreData

// MARK: - Design Tokens

/// Centralized design tokens for the Souvenir app's Liquid Glass aesthetic.
enum DesignTokens {

    // MARK: - Spacing

    enum Spacing {
        /// Micro spacing (4 pts)
        static let micro: CGFloat = 4
        /// Small spacing (8 pts)
        static let small: CGFloat = 8
        /// Medium spacing (12 pts)
        static let medium: CGFloat = 12
        /// Standard spacing (16 pts)
        static let standard: CGFloat = 17
        /// Large spacing (20 pts)
        static let large: CGFloat = 20
        /// Extra large spacing (24 pts)
        static let extraLarge: CGFloat = 22
        /// XX large spacing (24 pts)
        static let xxtraLarge: CGFloat = 28
        /// Jumbo spacing (36 pts)
        static let jumbo: CGFloat = 34
    }

    // MARK: - Corner Radii

    enum CornerRadius {
        /// Souvenir card container (4 pts)
        static let polaroid: CGFloat = 4
        /// Small buttons, badges (8 pts)
        static let small: CGFloat = 8
        /// Thumbnail markers, carousel previews (12 pts)
        static let medium: CGFloat = 12
        /// Carousel in focus view (16 pts)
        static let standard: CGFloat = 17
        /// Metadata drawer (20 pts)
        static let large: CGFloat = 20
        /// Extra large radius (24 pts)
        static let extraLarge: CGFloat = 22
        /// XX large radius (24 pts)
        static let xxtraLarge: CGFloat = 28
        /// Jumbo radius (36 pts)
        static let jumbo: CGFloat = 34
        /// Screen corner (64 pts)
        static let screen: CGFloat = 64
        /// Full circle
        static let circular: CGFloat = .infinity
    }

    // MARK: - Shadows

    enum Shadow {
        struct ShadowSpec {
            let color: Color
            let radius: CGFloat
            let x: CGFloat
            let y: CGFloat
        }

        /// Light mode polaroid shadow
        static let polaroidLight = ShadowSpec(
            color: .black.opacity(0.15),
            radius: 8,
            x: 0,
            y: 4
        )

        /// Dark mode polaroid shadow
        static let polaroidDark = ShadowSpec(
            color: .white.opacity(0.1),
            radius: 8,
            x: 0,
            y: 4
        )

        /// Thumbnail shadow
        static let thumbnail = ShadowSpec(
            color: .black.opacity(0.2),
            radius: 2,
            x: 0,
            y: 1
        )

        /// Metadata drawer shadow
        static let drawer = ShadowSpec(
            color: .black.opacity(0.2),
            radius: 10,
            x: 0,
            y: -5
        )

        /// Floating button shadow
        static let button = ShadowSpec(
            color: .black.opacity(0.15),
            radius: 4,
            x: 0,
            y: 2
        )
    }

    // MARK: - Animation

    enum Animation {
        /// Standard spring animation
        static let standardSpring = SwiftUI.Animation.spring(response: 0.4, dampingFraction: 0.8)
        /// Quick spring for button feedback
        static let quickSpring = SwiftUI.Animation.spring(response: 0.3, dampingFraction: 0.7)
        /// Bouncy spring for expansion
        static let bouncySpring = SwiftUI.Animation.spring(response: 0.4, dampingFraction: 0.6)
        /// Smooth overlay animation
        static let overlaySpring = SwiftUI.Animation.spring(response: 0.4, dampingFraction: 0.75)
        /// Button press duration
        static let buttonPress = SwiftUI.Animation.easeOut(duration: 0.12)
        /// View mode switch
        static let viewModeSwitch = SwiftUI.Animation.easeInOut(duration: 0.2)

        /// Returns instant animation if reduce motion is enabled
        static func withReduceMotion(_ animation: SwiftUI.Animation, reduceMotion: Bool) -> SwiftUI.Animation? {
            reduceMotion ? nil : animation
        }
    }

    // MARK: - Opacity

    enum Opacity {
        /// Subtle overlay (0.1)
        static let subtle: Double = 0.1
        /// Light overlay (0.2)
        static let light: Double = 0.2
        /// Medium overlay (0.3)
        static let medium: Double = 0.3
        /// Semi-transparent (0.5)
        static let semi: Double = 0.5
        /// Healthy overlay (0.618)
        static let healthy: Double = 0.618
        /// Strong overlay (0.75)
        static let strong: Double = 0.75
        /// Nearly opaque (0.9)
        static let nearlyOpaque: Double = 0.9
    }

    // MARK: - Sizes

    enum Size {
        /// Shutter button outer ring
        static let shutterButtonOuter: CGFloat = 75
        /// Shutter button inner disc
        static let shutterButtonInner: CGFloat = 63
        /// Library/toggle button
        static let navButton: CGFloat = 52
        /// Page indicator dot
        static let pageIndicator: CGFloat = 6
        /// Icon in button
        static let buttonIcon: CGFloat = 27
        /// Drawer handle width
        static let drawerHandle: CGFloat = 40
        /// Drawer handle height
        static let drawerHandleHeight: CGFloat = 5
    }

    // MARK: - Drawer States

    enum DrawerHeight {
        /// Fully closed (handle only)
        static let closed: CGFloat = 40
        /// Half closed (compact info)
        static let halfClosed: CGFloat = 120
        /// Fully open (all content)
        static let fullyOpen: CGFloat = 400
    }

    // MARK: - Pinch Gestures

    enum PinchThreshold {
        /// Threshold for pinch-to-zoom-out
        static let zoomOut: CGFloat = 0.7
        /// Minimum scale during pinch
        static let minScale: CGFloat = 0.5
    }

    // MARK: - ContactIsland

    enum ContactIsland {
        // Heights
        static let compactHeight: CGFloat = 75
        static let compactInlineLandscapeHeight: CGFloat = 64
        static let halfOpenHeight: CGFloat = 192
        static let fullSheetHeight: CGFloat = 440
        static let viewSheetHeight: CGFloat = 336
        static let searchSheetHeight: CGFloat = 360
        static let reviewSheetMinHeight: CGFloat = 440
        static let controlsReservedHeight: CGFloat = 133

        // Positioning
        static let floatingBottomPadding: CGFloat = 16
        static let compactMaxWidth: CGFloat = 320
        static let compactCornerRadius: CGFloat = 28
        static let compactInlineLandscapeCornerRadius: CGFloat = 32
        static let attachedCornerRadius: CGFloat = 24

        // Surface tuning
        static let compactSurfaceOpacity: CGFloat = 0.8382
        static let compactStrokeOpacity: CGFloat = 0.764
        static let compactInlineLandscapeSurfaceOpacity: CGFloat = 0.8382
        static let compactInlineLandscapeStrokeOpacity: CGFloat = 0.764

        // Handle
        static let handleWidth: CGFloat = 36
        static let handleHeight: CGFloat = 5
    }

    // MARK: - Gesture Thresholds

    enum Gesture {
        static let dragThreshold: CGFloat = 40
        static let velocityThreshold: CGFloat = 500
        static let islandVerticalThreshold: CGFloat = 60
        static let islandVelocityThreshold: CGFloat = 700
        static let islandHorizontalThreshold: CGFloat = 44
        /// Minimum horizontal distance to recognize as horizontal swipe
        static let horizontalMinDistance: CGFloat = 20
        /// Angle threshold in radians (atan2 ratio) for distinguishing horizontal from vertical
        static let directionAngleThreshold: CGFloat = 0.7
    }
}

// MARK: - Color Extension for Hex Support

extension Color {
    /// Initialize Color from hex string (e.g., "#FF6B35" or "FF6B35")
    init?(hex: String) {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")

        guard hexSanitized.count == 6 else { return nil }

        var rgb: UInt64 = 0
        guard Scanner(string: hexSanitized).scanHexInt64(&rgb) else { return nil }

        let r = Double((rgb & 0xFF0000) >> 16) / 255.0
        let g = Double((rgb & 0x00FF00) >> 8) / 255.0
        let b = Double(rgb & 0x0000FF) / 255.0

        self.init(red: r, green: g, blue: b)
    }

    /// Convert Color to hex string
    var hexString: String? {
        guard let components = UIColor(self).cgColor.components else { return nil }

        let r = components.count > 0 ? components[0] : 0
        let g = components.count > 1 ? components[1] : 0
        let b = components.count > 2 ? components[2] : 0

        return String(format: "#%02X%02X%02X",
                      Int(r * 255),
                      Int(g * 255),
                      Int(b * 255))
    }
}

// MARK: - Liquid Glass Blend Mode

private struct LiquidGlassBlendMode: ViewModifier {
    @Environment(\.colorScheme) private var colorScheme

    func body(content: Content) -> some View {
        content.blendMode(colorScheme == .dark ? .multiply : .screen)
    }
}

extension View {
    func liquidGlassBlendMode() -> some View {
        modifier(LiquidGlassBlendMode())
    }
}

// MARK: - UIColor Extension for Hex Support

extension UIColor {
    /// Initialize UIColor from hex string
    convenience init?(hex: String) {
        var hexSanitized = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        hexSanitized = hexSanitized.replacingOccurrences(of: "#", with: "")

        guard hexSanitized.count == 6 else { return nil }

        var rgb: UInt64 = 0
        guard Scanner(string: hexSanitized).scanHexInt64(&rgb) else { return nil }

        let r = CGFloat((rgb & 0xFF0000) >> 16) / 255.0
        let g = CGFloat((rgb & 0x00FF00) >> 8) / 255.0
        let b = CGFloat(rgb & 0x0000FF) / 255.0

        self.init(red: r, green: g, blue: b, alpha: 1.0)
    }

    /// Convert UIColor to hex string
    var hexString: String? {
        guard let components = cgColor.components else { return nil }

        let r = components.count > 0 ? components[0] : 0
        let g = components.count > 1 ? components[1] : 0
        let b = components.count > 2 ? components[2] : 0

        return String(format: "#%02X%02X%02X",
                      Int(r * 255),
                      Int(g * 255),
                      Int(b * 255))
    }
}

// MARK: - View Modifiers

extension View {
    /// Apply shadow from ShadowSpec
    func shadow(_ spec: DesignTokens.Shadow.ShadowSpec) -> some View {
        self.shadow(color: spec.color, radius: spec.radius, x: spec.x, y: spec.y)
    }

    /// Glass material button style
    func glassButton(colorScheme: ColorScheme) -> some View {
        self
            .padding(DesignTokens.Spacing.medium)
            .background(.ultraThinMaterial, in: Circle())
            .shadow(DesignTokens.Shadow.button)
    }

    /// Conditional animation based on reduce motion preference
    func animationWithReduceMotion(_ animation: Animation?, reduceMotion: Bool) -> some View {
        self.animation(reduceMotion ? nil : animation, value: UUID())
    }
}

// MARK: - Semantic Color Palette (Phase 12.4 Brand Identity)

extension Color {
    // Brand Colors
    static let brandPrimary = Color("AccentColor")
    static let brandSecondary = Color("SecondaryColor")
    static let brandTertiary = Color("TertiaryColor")
    static let brandDark = Color("AccentDarkColor")

    // Semantic Colors
    static let semanticSuccess = Color("SuccessColor")
    static let semanticWarning = Color("WarningColor")
    static let semanticError = Color("ErrorColor")
    static let semanticInfo = Color("InfoColor")

    // Liquid Glass Materials
    static let liquidGlassPrimary = Color("AccentColor").opacity(0.8)
    static let liquidGlassSecondary = Color("SecondaryColor").opacity(0.6)
    static let liquidGlassTertiary = Color("TertiaryColor").opacity(0.4)
}

/// A regular N-sided polygon centered in its rect, Insettable so it plays nicely
/// with `.strokeBorder` and `background(_, in:)`.
struct RegularPolygon: InsettableShape {
    let sides: Int          // e.g. 7 for heptagon
    var insetAmount: CGFloat = 0

    func path(in rect: CGRect) -> Path {
        guard sides >= 3 else { return Path() }

        // Shrink the drawing rect by insetAmount so strokes stay inside
        let insetRect = rect.insetBy(dx: insetAmount, dy: insetAmount)

        let center = CGPoint(x: insetRect.midX, y: insetRect.midY)
        let radius = min(insetRect.width, insetRect.height) / 2

        // Starting angle so one vertex is at the top (–90°)
        let startAngle = -CGFloat.pi / 2

        var path = Path()

        // Compute all vertices
        for i in 0..<sides {
            let angle = startAngle + (2 * .pi * CGFloat(i) / CGFloat(sides))
            let x = center.x + radius * cos(angle)
            let y = center.y + radius * sin(angle)
            let point = CGPoint(x: x, y: y)

            if i == 0 {
                path.move(to: point)
            } else {
                path.addLine(to: point)
            }
        }

        path.closeSubpath()
        return path
    }

    func inset(by amount: CGFloat) -> some InsettableShape {
        var copy = self
        copy.insetAmount += amount
        return copy
    }
}

// MARK: - Liquid Glass Material Effects

struct LiquidGlassModifier: ViewModifier {
    var color: Color = .brandPrimary
    var intensity: CGFloat = 0.8

    func body(content: Content) -> some View {
        content
            // Base material layer
            .background(.ultraThinMaterial)
            // Accent overlay on top of the material
            .overlay(
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.medium)
                    .fill(color.opacity(intensity * 0.3))
            )
            // Border effect
            .overlay(
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.medium)
                    .stroke(color.opacity(intensity * 0.6), lineWidth: 1)
            )
            .cornerRadius(DesignTokens.CornerRadius.medium)
            .shadow(
                color: color.opacity(intensity * 0.2),
                radius: 8,
                x: 0,
                y: 4
            )
    }
}

// Convenience extension for usage like: .liquidGlass()
extension View {
    func liquidGlass(
        color: Color = .brandPrimary,
        intensity: CGFloat = 0.8
    ) -> some View {
        modifier(LiquidGlassModifier(color: color, intensity: intensity))
    }
}

