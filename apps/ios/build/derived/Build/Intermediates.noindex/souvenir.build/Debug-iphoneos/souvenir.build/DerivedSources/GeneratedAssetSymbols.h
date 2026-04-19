#import <Foundation/Foundation.h>

#if __has_attribute(swift_private)
#define AC_SWIFT_PRIVATE __attribute__((swift_private))
#else
#define AC_SWIFT_PRIVATE
#endif

/// The resource bundle ID.
static NSString * const ACBundleID AC_SWIFT_PRIVATE = @"ink.kerry.souvenir";

/// The "AccentColor" asset catalog color resource.
static NSString * const ACColorNameAccentColor AC_SWIFT_PRIVATE = @"AccentColor";

/// The "ErrorSvnrColor" asset catalog color resource.
static NSString * const ACColorNameErrorSvnrColor AC_SWIFT_PRIVATE = @"ErrorSvnrColor";

/// The "InfoSvnrColor" asset catalog color resource.
static NSString * const ACColorNameInfoSvnrColor AC_SWIFT_PRIVATE = @"InfoSvnrColor";

/// The "SecondarySvnrColor" asset catalog color resource.
static NSString * const ACColorNameSecondarySvnrColor AC_SWIFT_PRIVATE = @"SecondarySvnrColor";

/// The "SuccessSvnrColor" asset catalog color resource.
static NSString * const ACColorNameSuccessSvnrColor AC_SWIFT_PRIVATE = @"SuccessSvnrColor";

/// The "TertiarySvnrColor" asset catalog color resource.
static NSString * const ACColorNameTertiarySvnrColor AC_SWIFT_PRIVATE = @"TertiarySvnrColor";

/// The "WarningSvnrColor" asset catalog color resource.
static NSString * const ACColorNameWarningSvnrColor AC_SWIFT_PRIVATE = @"WarningSvnrColor";

/// The "WinningSvnrColor" asset catalog color resource.
static NSString * const ACColorNameWinningSvnrColor AC_SWIFT_PRIVATE = @"WinningSvnrColor";

/// The "svnr-beach" asset catalog image resource.
static NSString * const ACImageNameSvnrBeach AC_SWIFT_PRIVATE = @"svnr-beach";

/// The "svnr-chalice" asset catalog image resource.
static NSString * const ACImageNameSvnrChalice AC_SWIFT_PRIVATE = @"svnr-chalice";

/// The "svnr-glyph-fill" asset catalog image resource.
static NSString * const ACImageNameSvnrGlyphFill AC_SWIFT_PRIVATE = @"svnr-glyph-fill";

/// The "svnr-glyph-fill2" asset catalog image resource.
static NSString * const ACImageNameSvnrGlyphFill2 AC_SWIFT_PRIVATE = @"svnr-glyph-fill2";

/// The "svnr-glyph-line" asset catalog image resource.
static NSString * const ACImageNameSvnrGlyphLine AC_SWIFT_PRIVATE = @"svnr-glyph-line";

/// The "svnr-glyph-line2" asset catalog image resource.
static NSString * const ACImageNameSvnrGlyphLine2 AC_SWIFT_PRIVATE = @"svnr-glyph-line2";

/// The "svnr-surf" asset catalog image resource.
static NSString * const ACImageNameSvnrSurf AC_SWIFT_PRIVATE = @"svnr-surf";

#undef AC_SWIFT_PRIVATE
