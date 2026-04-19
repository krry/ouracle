import Foundation
#if canImport(AppKit)
import AppKit
#endif
#if canImport(UIKit)
import UIKit
#endif
#if canImport(SwiftUI)
import SwiftUI
#endif
#if canImport(DeveloperToolsSupport)
import DeveloperToolsSupport
#endif

#if SWIFT_PACKAGE
private let resourceBundle = Foundation.Bundle.module
#else
private class ResourceBundleClass {}
private let resourceBundle = Foundation.Bundle(for: ResourceBundleClass.self)
#endif

// MARK: - Color Symbols -

@available(iOS 17.0, macOS 14.0, tvOS 17.0, watchOS 10.0, *)
extension DeveloperToolsSupport.ColorResource {

    /// The "AccentColor" asset catalog color resource.
    static let accent = DeveloperToolsSupport.ColorResource(name: "AccentColor", bundle: resourceBundle)

    /// The "ErrorSvnrColor" asset catalog color resource.
    static let errorSvnr = DeveloperToolsSupport.ColorResource(name: "ErrorSvnrColor", bundle: resourceBundle)

    /// The "InfoSvnrColor" asset catalog color resource.
    static let infoSvnr = DeveloperToolsSupport.ColorResource(name: "InfoSvnrColor", bundle: resourceBundle)

    /// The "SecondarySvnrColor" asset catalog color resource.
    static let secondarySvnr = DeveloperToolsSupport.ColorResource(name: "SecondarySvnrColor", bundle: resourceBundle)

    /// The "SuccessSvnrColor" asset catalog color resource.
    static let successSvnr = DeveloperToolsSupport.ColorResource(name: "SuccessSvnrColor", bundle: resourceBundle)

    /// The "TertiarySvnrColor" asset catalog color resource.
    static let tertiarySvnr = DeveloperToolsSupport.ColorResource(name: "TertiarySvnrColor", bundle: resourceBundle)

    /// The "WarningSvnrColor" asset catalog color resource.
    static let warningSvnr = DeveloperToolsSupport.ColorResource(name: "WarningSvnrColor", bundle: resourceBundle)

    /// The "WinningSvnrColor" asset catalog color resource.
    static let winningSvnr = DeveloperToolsSupport.ColorResource(name: "WinningSvnrColor", bundle: resourceBundle)

}

// MARK: - Image Symbols -

@available(iOS 17.0, macOS 14.0, tvOS 17.0, watchOS 10.0, *)
extension DeveloperToolsSupport.ImageResource {

    /// The "svnr-beach" asset catalog image resource.
    static let svnrBeach = DeveloperToolsSupport.ImageResource(name: "svnr-beach", bundle: resourceBundle)

    /// The "svnr-chalice" asset catalog image resource.
    static let svnrChalice = DeveloperToolsSupport.ImageResource(name: "svnr-chalice", bundle: resourceBundle)

    /// The "svnr-glyph-fill" asset catalog image resource.
    static let svnrGlyphFill = DeveloperToolsSupport.ImageResource(name: "svnr-glyph-fill", bundle: resourceBundle)

    /// The "svnr-glyph-fill2" asset catalog image resource.
    static let svnrGlyphFill2 = DeveloperToolsSupport.ImageResource(name: "svnr-glyph-fill2", bundle: resourceBundle)

    /// The "svnr-glyph-line" asset catalog image resource.
    static let svnrGlyphLine = DeveloperToolsSupport.ImageResource(name: "svnr-glyph-line", bundle: resourceBundle)

    /// The "svnr-glyph-line2" asset catalog image resource.
    static let svnrGlyphLine2 = DeveloperToolsSupport.ImageResource(name: "svnr-glyph-line2", bundle: resourceBundle)

    /// The "svnr-surf" asset catalog image resource.
    static let svnrSurf = DeveloperToolsSupport.ImageResource(name: "svnr-surf", bundle: resourceBundle)

}

// MARK: - Color Symbol Extensions -

#if canImport(AppKit)
@available(macOS 14.0, *)
@available(macCatalyst, unavailable)
extension AppKit.NSColor {

    /// The "AccentColor" asset catalog color.
    static var accent: AppKit.NSColor {
#if !targetEnvironment(macCatalyst)
        .init(resource: .accent)
#else
        .init()
#endif
    }

    /// The "ErrorSvnrColor" asset catalog color.
    static var errorSvnr: AppKit.NSColor {
#if !targetEnvironment(macCatalyst)
        .init(resource: .errorSvnr)
#else
        .init()
#endif
    }

    /// The "InfoSvnrColor" asset catalog color.
    static var infoSvnr: AppKit.NSColor {
#if !targetEnvironment(macCatalyst)
        .init(resource: .infoSvnr)
#else
        .init()
#endif
    }

    /// The "SecondarySvnrColor" asset catalog color.
    static var secondarySvnr: AppKit.NSColor {
#if !targetEnvironment(macCatalyst)
        .init(resource: .secondarySvnr)
#else
        .init()
#endif
    }

    /// The "SuccessSvnrColor" asset catalog color.
    static var successSvnr: AppKit.NSColor {
#if !targetEnvironment(macCatalyst)
        .init(resource: .successSvnr)
#else
        .init()
#endif
    }

    /// The "TertiarySvnrColor" asset catalog color.
    static var tertiarySvnr: AppKit.NSColor {
#if !targetEnvironment(macCatalyst)
        .init(resource: .tertiarySvnr)
#else
        .init()
#endif
    }

    /// The "WarningSvnrColor" asset catalog color.
    static var warningSvnr: AppKit.NSColor {
#if !targetEnvironment(macCatalyst)
        .init(resource: .warningSvnr)
#else
        .init()
#endif
    }

    /// The "WinningSvnrColor" asset catalog color.
    static var winningSvnr: AppKit.NSColor {
#if !targetEnvironment(macCatalyst)
        .init(resource: .winningSvnr)
#else
        .init()
#endif
    }

}
#endif

#if canImport(UIKit)
@available(iOS 17.0, tvOS 17.0, *)
@available(watchOS, unavailable)
extension UIKit.UIColor {

    /// The "AccentColor" asset catalog color.
    static var accent: UIKit.UIColor {
#if !os(watchOS)
        .init(resource: .accent)
#else
        .init()
#endif
    }

    /// The "ErrorSvnrColor" asset catalog color.
    static var errorSvnr: UIKit.UIColor {
#if !os(watchOS)
        .init(resource: .errorSvnr)
#else
        .init()
#endif
    }

    /// The "InfoSvnrColor" asset catalog color.
    static var infoSvnr: UIKit.UIColor {
#if !os(watchOS)
        .init(resource: .infoSvnr)
#else
        .init()
#endif
    }

    /// The "SecondarySvnrColor" asset catalog color.
    static var secondarySvnr: UIKit.UIColor {
#if !os(watchOS)
        .init(resource: .secondarySvnr)
#else
        .init()
#endif
    }

    /// The "SuccessSvnrColor" asset catalog color.
    static var successSvnr: UIKit.UIColor {
#if !os(watchOS)
        .init(resource: .successSvnr)
#else
        .init()
#endif
    }

    /// The "TertiarySvnrColor" asset catalog color.
    static var tertiarySvnr: UIKit.UIColor {
#if !os(watchOS)
        .init(resource: .tertiarySvnr)
#else
        .init()
#endif
    }

    /// The "WarningSvnrColor" asset catalog color.
    static var warningSvnr: UIKit.UIColor {
#if !os(watchOS)
        .init(resource: .warningSvnr)
#else
        .init()
#endif
    }

    /// The "WinningSvnrColor" asset catalog color.
    static var winningSvnr: UIKit.UIColor {
#if !os(watchOS)
        .init(resource: .winningSvnr)
#else
        .init()
#endif
    }

}
#endif

#if canImport(SwiftUI)
@available(iOS 17.0, macOS 14.0, tvOS 17.0, watchOS 10.0, *)
extension SwiftUI.Color {

    /// The "AccentColor" asset catalog color.
    static var accent: SwiftUI.Color { .init(.accent) }

    /// The "ErrorSvnrColor" asset catalog color.
    static var errorSvnr: SwiftUI.Color { .init(.errorSvnr) }

    /// The "InfoSvnrColor" asset catalog color.
    static var infoSvnr: SwiftUI.Color { .init(.infoSvnr) }

    /// The "SecondarySvnrColor" asset catalog color.
    static var secondarySvnr: SwiftUI.Color { .init(.secondarySvnr) }

    /// The "SuccessSvnrColor" asset catalog color.
    static var successSvnr: SwiftUI.Color { .init(.successSvnr) }

    /// The "TertiarySvnrColor" asset catalog color.
    static var tertiarySvnr: SwiftUI.Color { .init(.tertiarySvnr) }

    /// The "WarningSvnrColor" asset catalog color.
    static var warningSvnr: SwiftUI.Color { .init(.warningSvnr) }

    /// The "WinningSvnrColor" asset catalog color.
    static var winningSvnr: SwiftUI.Color { .init(.winningSvnr) }

}

@available(iOS 17.0, macOS 14.0, tvOS 17.0, watchOS 10.0, *)
extension SwiftUI.ShapeStyle where Self == SwiftUI.Color {

    /// The "AccentColor" asset catalog color.
    static var accent: SwiftUI.Color { .init(.accent) }

    /// The "ErrorSvnrColor" asset catalog color.
    static var errorSvnr: SwiftUI.Color { .init(.errorSvnr) }

    /// The "InfoSvnrColor" asset catalog color.
    static var infoSvnr: SwiftUI.Color { .init(.infoSvnr) }

    /// The "SecondarySvnrColor" asset catalog color.
    static var secondarySvnr: SwiftUI.Color { .init(.secondarySvnr) }

    /// The "SuccessSvnrColor" asset catalog color.
    static var successSvnr: SwiftUI.Color { .init(.successSvnr) }

    /// The "TertiarySvnrColor" asset catalog color.
    static var tertiarySvnr: SwiftUI.Color { .init(.tertiarySvnr) }

    /// The "WarningSvnrColor" asset catalog color.
    static var warningSvnr: SwiftUI.Color { .init(.warningSvnr) }

    /// The "WinningSvnrColor" asset catalog color.
    static var winningSvnr: SwiftUI.Color { .init(.winningSvnr) }

}
#endif

// MARK: - Image Symbol Extensions -

#if canImport(AppKit)
@available(macOS 14.0, *)
@available(macCatalyst, unavailable)
extension AppKit.NSImage {

    /// The "svnr-beach" asset catalog image.
    static var svnrBeach: AppKit.NSImage {
#if !targetEnvironment(macCatalyst)
        .init(resource: .svnrBeach)
#else
        .init()
#endif
    }

    /// The "svnr-chalice" asset catalog image.
    static var svnrChalice: AppKit.NSImage {
#if !targetEnvironment(macCatalyst)
        .init(resource: .svnrChalice)
#else
        .init()
#endif
    }

    /// The "svnr-glyph-fill" asset catalog image.
    static var svnrGlyphFill: AppKit.NSImage {
#if !targetEnvironment(macCatalyst)
        .init(resource: .svnrGlyphFill)
#else
        .init()
#endif
    }

    /// The "svnr-glyph-fill2" asset catalog image.
    static var svnrGlyphFill2: AppKit.NSImage {
#if !targetEnvironment(macCatalyst)
        .init(resource: .svnrGlyphFill2)
#else
        .init()
#endif
    }

    /// The "svnr-glyph-line" asset catalog image.
    static var svnrGlyphLine: AppKit.NSImage {
#if !targetEnvironment(macCatalyst)
        .init(resource: .svnrGlyphLine)
#else
        .init()
#endif
    }

    /// The "svnr-glyph-line2" asset catalog image.
    static var svnrGlyphLine2: AppKit.NSImage {
#if !targetEnvironment(macCatalyst)
        .init(resource: .svnrGlyphLine2)
#else
        .init()
#endif
    }

    /// The "svnr-surf" asset catalog image.
    static var svnrSurf: AppKit.NSImage {
#if !targetEnvironment(macCatalyst)
        .init(resource: .svnrSurf)
#else
        .init()
#endif
    }

}
#endif

#if canImport(UIKit)
@available(iOS 17.0, tvOS 17.0, *)
@available(watchOS, unavailable)
extension UIKit.UIImage {

    /// The "svnr-beach" asset catalog image.
    static var svnrBeach: UIKit.UIImage {
#if !os(watchOS)
        .init(resource: .svnrBeach)
#else
        .init()
#endif
    }

    /// The "svnr-chalice" asset catalog image.
    static var svnrChalice: UIKit.UIImage {
#if !os(watchOS)
        .init(resource: .svnrChalice)
#else
        .init()
#endif
    }

    /// The "svnr-glyph-fill" asset catalog image.
    static var svnrGlyphFill: UIKit.UIImage {
#if !os(watchOS)
        .init(resource: .svnrGlyphFill)
#else
        .init()
#endif
    }

    /// The "svnr-glyph-fill2" asset catalog image.
    static var svnrGlyphFill2: UIKit.UIImage {
#if !os(watchOS)
        .init(resource: .svnrGlyphFill2)
#else
        .init()
#endif
    }

    /// The "svnr-glyph-line" asset catalog image.
    static var svnrGlyphLine: UIKit.UIImage {
#if !os(watchOS)
        .init(resource: .svnrGlyphLine)
#else
        .init()
#endif
    }

    /// The "svnr-glyph-line2" asset catalog image.
    static var svnrGlyphLine2: UIKit.UIImage {
#if !os(watchOS)
        .init(resource: .svnrGlyphLine2)
#else
        .init()
#endif
    }

    /// The "svnr-surf" asset catalog image.
    static var svnrSurf: UIKit.UIImage {
#if !os(watchOS)
        .init(resource: .svnrSurf)
#else
        .init()
#endif
    }

}
#endif

// MARK: - Thinnable Asset Support -

@available(iOS 17.0, macOS 14.0, tvOS 17.0, watchOS 10.0, *)
@available(watchOS, unavailable)
extension DeveloperToolsSupport.ColorResource {

    private init?(thinnableName: Swift.String, bundle: Foundation.Bundle) {
#if canImport(AppKit) && os(macOS)
        if AppKit.NSColor(named: NSColor.Name(thinnableName), bundle: bundle) != nil {
            self.init(name: thinnableName, bundle: bundle)
        } else {
            return nil
        }
#elseif canImport(UIKit) && !os(watchOS)
        if UIKit.UIColor(named: thinnableName, in: bundle, compatibleWith: nil) != nil {
            self.init(name: thinnableName, bundle: bundle)
        } else {
            return nil
        }
#else
        return nil
#endif
    }

}

#if canImport(AppKit)
@available(macOS 14.0, *)
@available(macCatalyst, unavailable)
extension AppKit.NSColor {

    private convenience init?(thinnableResource: DeveloperToolsSupport.ColorResource?) {
#if !targetEnvironment(macCatalyst)
        if let resource = thinnableResource {
            self.init(resource: resource)
        } else {
            return nil
        }
#else
        return nil
#endif
    }

}
#endif

#if canImport(UIKit)
@available(iOS 17.0, tvOS 17.0, *)
@available(watchOS, unavailable)
extension UIKit.UIColor {

    private convenience init?(thinnableResource: DeveloperToolsSupport.ColorResource?) {
#if !os(watchOS)
        if let resource = thinnableResource {
            self.init(resource: resource)
        } else {
            return nil
        }
#else
        return nil
#endif
    }

}
#endif

#if canImport(SwiftUI)
@available(iOS 17.0, macOS 14.0, tvOS 17.0, watchOS 10.0, *)
extension SwiftUI.Color {

    private init?(thinnableResource: DeveloperToolsSupport.ColorResource?) {
        if let resource = thinnableResource {
            self.init(resource)
        } else {
            return nil
        }
    }

}

@available(iOS 17.0, macOS 14.0, tvOS 17.0, watchOS 10.0, *)
extension SwiftUI.ShapeStyle where Self == SwiftUI.Color {

    private init?(thinnableResource: DeveloperToolsSupport.ColorResource?) {
        if let resource = thinnableResource {
            self.init(resource)
        } else {
            return nil
        }
    }

}
#endif

@available(iOS 17.0, macOS 14.0, tvOS 17.0, watchOS 10.0, *)
@available(watchOS, unavailable)
extension DeveloperToolsSupport.ImageResource {

    private init?(thinnableName: Swift.String, bundle: Foundation.Bundle) {
#if canImport(AppKit) && os(macOS)
        if bundle.image(forResource: NSImage.Name(thinnableName)) != nil {
            self.init(name: thinnableName, bundle: bundle)
        } else {
            return nil
        }
#elseif canImport(UIKit) && !os(watchOS)
        if UIKit.UIImage(named: thinnableName, in: bundle, compatibleWith: nil) != nil {
            self.init(name: thinnableName, bundle: bundle)
        } else {
            return nil
        }
#else
        return nil
#endif
    }

}

#if canImport(AppKit)
@available(macOS 14.0, *)
@available(macCatalyst, unavailable)
extension AppKit.NSImage {

    private convenience init?(thinnableResource: DeveloperToolsSupport.ImageResource?) {
#if !targetEnvironment(macCatalyst)
        if let resource = thinnableResource {
            self.init(resource: resource)
        } else {
            return nil
        }
#else
        return nil
#endif
    }

}
#endif

#if canImport(UIKit)
@available(iOS 17.0, tvOS 17.0, *)
@available(watchOS, unavailable)
extension UIKit.UIImage {

    private convenience init?(thinnableResource: DeveloperToolsSupport.ImageResource?) {
#if !os(watchOS)
        if let resource = thinnableResource {
            self.init(resource: resource)
        } else {
            return nil
        }
#else
        return nil
#endif
    }

}
#endif

