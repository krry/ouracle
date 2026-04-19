import Foundation

public struct EeliotConfiguration: Sendable {
    public let baseURL: URL
    public let appSlug: String
    public let appSecret: String

    public init(baseURL: URL, appSlug: String, appSecret: String) {
        self.baseURL = baseURL
        self.appSlug = appSlug
        self.appSecret = appSecret
    }
}

