import Foundation

enum EeliotInstallID {
    private static let key = "eeliot.install_id"

    static func loadOrCreate(userDefaults: UserDefaults = .standard) -> String {
        if let existing = userDefaults.string(forKey: key), !existing.isEmpty {
            return existing
        }
        let id = UUID().uuidString
        userDefaults.set(id, forKey: key)
        return id
    }
}

