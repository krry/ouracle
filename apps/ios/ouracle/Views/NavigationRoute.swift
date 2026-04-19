import Foundation

enum Route: Hashable {
    case chat
    case thread(id: UUID)
    case records
    case record(id: UUID)
    case settings
    case devTools
}
