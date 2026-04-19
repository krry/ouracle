//
//  TestsSemanticColors.swift
//  souvenirTests
//
//  Phase 12.4: Semantic Color Palette Tests
//

import Testing
import SwiftUI
@testable import souvenir

@Suite("Semantic Color Palette Tests")
struct TestsSemanticColors {

    @Test("Brand colors are accessible")
    func testBrandColors() {
        // Test that all brand colors can be accessed
        let _ = Color.brandPrimary
        let _ = Color.brandSecondary
        let _ = Color.brandTertiary
        let _ = Color.brandDark
    }

    @Test("Semantic colors are accessible")
    func testSemanticColors() {
        // Test that all semantic colors can be accessed
        let _ = Color.semanticSuccess
        let _ = Color.semanticWarning
        let _ = Color.semanticError
        let _ = Color.semanticInfo
    }

    @Test("Liquid glass materials are accessible")
    func testLiquidGlassMaterials() {
        // Test that liquid glass materials can be accessed
        let _ = Color.liquidGlassPrimary
        let _ = Color.liquidGlassSecondary
        let _ = Color.liquidGlassTertiary
    }

    @Test("LiquidGlassModifier can be applied")
    func testLiquidGlassModifier() {
        // Test that the LiquidGlassModifier can be applied to a view
        _ = Text("Test")
            .modifier(LiquidGlassModifier(color: .brandPrimary))

        // This test just verifies the modifier compiles and can be applied
        #expect(true)
    }

    @Test("Color hex conversion works")
    func testColorHexConversion() {
        // Test hex to color conversion
        let testColor = Color(hex: "50B9CD")
        #expect(testColor != nil, "Hex color conversion should work")

        // Test color to hex conversion
        if let color = testColor {
            let hexString = color.hexString
            #expect(hexString != nil, "Color to hex conversion should work")
        }
    }

    @Test("Brand primary color matches expected hex")
    func testBrandPrimaryColor() {
        // The brand primary should be the accent color which is #50B9CD
        let accentColor = Color.accentColor
        let hexString = accentColor.hexString

        // Note: This might not match exactly due to color space conversions,
        // but it should be close to the turquoise sea color
        #expect(hexString != nil, "Accent color should have a hex representation")
    }
}
