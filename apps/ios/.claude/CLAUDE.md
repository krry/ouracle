# CLAUDE.md — apps/ios (ouracle)

SwiftUI app. Bundle ID: `ink.kerry.ouracle`. Xcode 16. iOS 17+.

## Build commands

```bash
# Simulator build
xcodebuild -scheme ouracle -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build

# Device build
xcodebuild -scheme ouracle -configuration Debug -destination 'platform=iOS,name=Handfill' build

# Unit tests
xcodebuild test -scheme ouracle -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
```

Run a build after any substantial code change. Fix all errors before continuing.

## Stack

SwiftUI + Core Data (NSPersistentContainer). Swift Testing for unit tests, XCTest for UI tests.
`SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor`.

## API

Base URL: `https://api.ouracle.kerry.ink`
Override in debug: set `OURACLE_API_BASE_URL` in Xcode scheme environment variables.

## Auth

Device keypair auth — no phone, no OTP, no BetterAuth.
- `IdentityService` generates two Curve25519 keypairs on first launch, persists in Keychain.
- `DeviceAuthService.authenticate()` runs challenge/sign/verify on every launch.
- Tokens stored in Keychain under `device.*` namespace.
- `AuthService` is the token coordinator; all API calls use `activeAccessToken`.

## Actor isolation rule

- `@MainActor` for UI, observable state, view coordination, `viewContext` Core Data work.
- Actor-neutral types (DTOs, codecs, crypto helpers, request/response types) go in `Utilities/`.
- Do not add `import UIKit` in SwiftUI files — SwiftUI imports it transitively.

## File naming

- Views: `Views*.swift`
- Services: `Services*.swift`
- Utilities: `Utilities*.swift`
- Models: `Models*+CoreDataClass.swift`, `Models*+CoreDataProperties.swift`
- Tests: `Tests*.swift`

## Design tokens (mirrors Ouracle web)

- jing: 217° · shen: 354° · qi: 80°
- Display: New York/Georgia serif
- Sans: SF Pro/system-ui
- Mono: SF Mono (code only)

## Directory layout

```
ouracle/
├── Models/       Core Data entities + PersistenceController
├── Views/        SwiftUI views (Views*.swift)
├── Services/     Business logic (Services*.swift)
├── Utilities/    Helpers (Utilities*.swift)
└── Eeliot/       Analytics engine
```

## Versioning

- `MARKETING_VERSION` — user-facing, bump per release line
- `CURRENT_PROJECT_VERSION` — bump every archive/upload

## Anti-patterns — never do these

**`UIScreen.main` / `UIScreen.main.bounds`** — deprecated iOS 16. Use GeometryReader.

**`import UIKit` in SwiftUI files** — causes cascading SourceKit errors. Remove it.
