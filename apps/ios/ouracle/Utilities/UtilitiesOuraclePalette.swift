//
//  UtilitiesOuraclePalette.swift
//  souvenir
//
//  Dynamic palette derived from favorite background photo
//

import SwiftUI

struct OuraclePalette: Equatable {
    let accent: UIColor
    let secondary: UIColor
    let tertiary: UIColor

    static func derive(from accent: UIColor) -> OuraclePalette {
        var hue: CGFloat = 0
        var saturation: CGFloat = 0
        var brightness: CGFloat = 0
        var alpha: CGFloat = 0
        accent.getHue(&hue, saturation: &saturation, brightness: &brightness, alpha: &alpha)

        let secondary = UIColor(
            hue: hue,
            saturation: max(saturation * 0.45, 0.18),
            brightness: min(max(brightness * 1.15, 0.35), 0.9),
            alpha: 1.0
        )

        let tertiary = UIColor(
            hue: hue,
            saturation: max(saturation * 0.25, 0.12),
            brightness: min(max(brightness * 1.25, 0.45), 0.95),
            alpha: 1.0
        )

        return OuraclePalette(accent: accent, secondary: secondary, tertiary: tertiary)
    }
}

enum OuraclePaletteStore {
    private static let accentKey = "ouracleAccentHex"
    private static let secondaryKey = "ouracleSecondaryHex"
    private static let tertiaryKey = "ouracleTertiaryHex"

    static func setPalette(_ palette: OuraclePalette) {
        let defaults = UserDefaults.standard
        defaults.set(palette.accent.hexString, forKey: accentKey)
        defaults.set(palette.secondary.hexString, forKey: secondaryKey)
        defaults.set(palette.tertiary.hexString, forKey: tertiaryKey)
    }

    static func reset() {
        let defaults = UserDefaults.standard
        defaults.removeObject(forKey: accentKey)
        defaults.removeObject(forKey: secondaryKey)
        defaults.removeObject(forKey: tertiaryKey)
    }

    static func accentColor() -> Color? {
        guard let hex = UserDefaults.standard.string(forKey: accentKey),
              let color = Color(hex: hex) else {
            return nil
        }
        return color
    }

    static func secondaryColor() -> Color? {
        guard let hex = UserDefaults.standard.string(forKey: secondaryKey),
              let color = Color(hex: hex) else {
            return nil
        }
        return color
    }

    static func tertiaryColor() -> Color? {
        guard let hex = UserDefaults.standard.string(forKey: tertiaryKey),
              let color = Color(hex: hex) else {
            return nil
        }
        return color
    }
}

extension Color {
    static var accentOuracle: Color {
        OuraclePaletteStore.accentColor() ?? Color("AccentColor")
    }

    // Three treasures — mirrors Ouracle web design tokens, adaptive light/dark
    static let jing = Color(uiColor: UIColor(dynamicProvider: { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(hue: 217/360, saturation: 0.62, brightness: 0.82, alpha: 1)
            : UIColor(hue: 217/360, saturation: 0.75, brightness: 0.50, alpha: 1)
    }))
    static let shen = Color(uiColor: UIColor(dynamicProvider: { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(hue: 354/360, saturation: 0.65, brightness: 0.82, alpha: 1)
            : UIColor(hue: 354/360, saturation: 0.82, brightness: 0.52, alpha: 1)
    }))
    static let qi = Color(uiColor: UIColor(dynamicProvider: { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(hue: 80/360, saturation: 0.60, brightness: 0.76, alpha: 1)
            : UIColor(hue: 80/360, saturation: 0.70, brightness: 0.45, alpha: 1)
    }))
}

extension Color {
    static var dynamicSecondaryOuracle: Color {
        OuraclePaletteStore.secondaryColor() ?? Color("SecondaryOuracleColor")
    }

    static var dynamicTertiaryOuracle: Color {
        OuraclePaletteStore.tertiaryColor() ?? Color("TertiaryOuracleColor")
    }
}
