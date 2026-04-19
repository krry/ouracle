import SwiftUI

/// OURACLE UI Kit components (thin wrappers over SwiftUI).

private enum GlassStyling {
    /// UIKit separator color is designed to be visible in both light/dark appearances.
    static var outline: Color { Color(uiColor: .separator) }
}

struct NakedIconButton: View {
    let systemName: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemName)
                .ouracleSymbolPalette()
        }
        .buttonStyle(.plain)
    }
}

struct PrimaryCtaButton: View {
    let title: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.headline.weight(.semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, DesignTokens.Spacing.medium)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .buttonStyle(.plain)
    }
}

struct ContactInfoRow: View {
    let systemImage: String
    let text: String

    var body: some View {
        Label(text, systemImage: systemImage)
            .font(.subheadline.weight(.medium))
            .foregroundStyle(.primary)
    }
}

struct GlassTextField: View {
    let title: String
    @Binding var text: String
    var font: Font = .body
    var keyboardType: UIKeyboardType = .default
    var textContentType: UITextContentType? = nil
    var autocapitalization: TextInputAutocapitalization = .sentences
    var showsFloatingLabel: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.micro) {
            if showsFloatingLabel {
                Text(title)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 2)
            }
            TextField(title, text: $text)
                .font(font)
                .keyboardType(keyboardType)
                .textContentType(textContentType)
                .textInputAutocapitalization(autocapitalization)
        }
            .padding(.horizontal, DesignTokens.Spacing.medium)
            .padding(.vertical, DesignTokens.Spacing.medium)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(GlassStyling.outline, lineWidth: 1)
            )
    }
}

struct GlassCapsuleButton: View {
    let title: String
    let systemImage: String
    var isDestructive: Bool = false
    var foreground: Color = .primary
    var backgroundTint: Color? = nil
    var imageFont: Font = .caption.weight(.semibold)
    var textFont: Font = .subheadline.weight(.semibold)
    var useSymbolPalette: Bool = true
    let action: () -> Void
    
    private var hasTitle: Bool {
        !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var body: some View {
        Button(action: action) {
            HStack(spacing: hasTitle ? DesignTokens.Spacing.small : 0) {
                if useSymbolPalette {
                    Image(systemName: systemImage)
                        .font(imageFont)
                        .ouracleSymbolPalette()
                } else {
                    Image(systemName: systemImage)
                        .font(imageFont)
                        .foregroundStyle(isDestructive ? Color.dangerOuracle : foreground)
                }
                if hasTitle {
                    Text(title)
                        .font(textFont)
                        .foregroundStyle(isDestructive ? Color.dangerOuracle : foreground)
                }
            }
            .padding(.horizontal, hasTitle ? DesignTokens.Spacing.medium : DesignTokens.Spacing.small)
            .padding(.vertical, DesignTokens.Spacing.small)
            .background(
                ZStack {
                    Capsule().fill(.ultraThinMaterial)
                    if let backgroundTint {
                        Capsule().fill(backgroundTint)
                    }
                }
            )
            .overlay(
                Capsule()
                    .strokeBorder(GlassStyling.outline, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

struct ShareStatusPill: View {
    let systemImage: String
    let text: String
    let color: Color

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.small) {
            Image(systemName: systemImage)
                .font(.caption.weight(.semibold))
                .foregroundStyle(color)
            Text(text)
                .font(.caption.weight(.medium))
                .foregroundStyle(.primary)
        }
        .padding(.horizontal, DesignTokens.Spacing.medium)
        .padding(.vertical, DesignTokens.Spacing.small)
        .background(.ultraThinMaterial, in: Capsule())
        .overlay(Capsule().strokeBorder(GlassStyling.outline, lineWidth: 1))
    }
}

extension View {
    func ouracleSymbolPalette() -> some View {
        self
            .symbolRenderingMode(.palette)
            .foregroundStyle(.primary, Color.accentColor, Color.secondary)
    }
}

struct GlassSheetContainer<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .background(.ultraThinMaterial)
    }
}
