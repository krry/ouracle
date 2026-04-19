import Foundation
import Security

/// Thin wrapper around SecItem for string values.
enum Keychain {
  static let service = "ink.kerry.ouracle"

  static func save(_ value: String, forKey key: String) {
    let data = Data(value.utf8)
    let query: [CFString: Any] = [
      kSecClass: kSecClassGenericPassword,
      kSecAttrService: service,
      kSecAttrAccount: key,
    ]
    SecItemDelete(query as CFDictionary)
    var attrs = query
    attrs[kSecValueData] = data
    SecItemAdd(attrs as CFDictionary, nil)
  }

  static func load(forKey key: String) -> String? {
    let query: [CFString: Any] = [
      kSecClass: kSecClassGenericPassword,
      kSecAttrService: service,
      kSecAttrAccount: key,
      kSecReturnData: true,
      kSecMatchLimit: kSecMatchLimitOne,
    ]
    var result: AnyObject?
    guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
          let data = result as? Data else { return nil }
    return String(data: data, encoding: .utf8)
  }

  static func delete(forKey key: String) {
    let query: [CFString: Any] = [
      kSecClass: kSecClassGenericPassword,
      kSecAttrService: service,
      kSecAttrAccount: key,
    ]
    SecItemDelete(query as CFDictionary)
  }

  static func save(_ data: Data, forKey key: String) {
    let query: [CFString: Any] = [
      kSecClass: kSecClassGenericPassword,
      kSecAttrService: service,
      kSecAttrAccount: key,
      kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlock,
    ]
    SecItemDelete(query as CFDictionary)
    var attrs = query
    attrs[kSecValueData] = data
    SecItemAdd(attrs as CFDictionary, nil)
  }

  static func loadData(forKey key: String) -> Data? {
    let query: [CFString: Any] = [
      kSecClass: kSecClassGenericPassword,
      kSecAttrService: service,
      kSecAttrAccount: key,
      kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlock,
      kSecReturnData: true,
      kSecMatchLimit: kSecMatchLimitOne,
    ]
    var result: AnyObject?
    guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
          let data = result as? Data else { return nil }
    return data
  }
}
