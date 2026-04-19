//
//  ServicesDeviceAuthService.swift
//  souvenir
//
//  Handles device-based auth for BLE handshakes.
//  Uses the device's existing IdentityService keys to exchange a challenge,
//  then stores the server tokens in Keychain under the device.* namespace.
//

import Foundation
import Combine
import CryptoKit

enum DeviceAuthError: LocalizedError {
    case invalidNonce
    case networkFailure(String)
    case sessionExpired

    var errorDescription: String? {
        switch self {
        case .invalidNonce:
            return "The device auth challenge was invalid."
        case .networkFailure(let msg):
            return msg
        case .sessionExpired:
            return "Session expired. Please reconnect nearby."
        }
    }
}

@MainActor
final class DeviceAuthService: ObservableObject {

    static let shared = DeviceAuthService()

    @Published private(set) var isAuthenticated: Bool = false

    private let baseURL: String

    private let accessKey  = "device.accessToken"
    private let refreshKey = "device.refreshToken"
    private let seekerKey  = "device.seekerID"
    private let session: URLSession

    init(session: URLSession = .shared, baseURL: String? = nil) {
        self.session = session
        self.baseURL = Self.resolveBaseURL(override: baseURL)
        syncSessionState()
    }

    private static func resolveBaseURL(override: String?) -> String {
        if let override {
            return override
        }
        #if DEBUG
        let env = ProcessInfo.processInfo.environment["OURACLE_API_BASE_URL"]?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if let env, !env.isEmpty {
            return env
        }
        #endif
        return "https://api.ouracle.kerry.ink"
    }

    /// Runs the full device auth flow:
    /// 1. POST /auth/device/challenge
    /// 2. Sign the nonce with IdentityService.shared
    /// 3. POST /auth/device/verify
    /// 4. Store the returned tokens
    func authenticate() async throws {
        let signingKeyB64 = IdentityService.shared.signingPublicKey.rawRepresentation.base64EncodedString()
        let challenge: ChallengeResponse = try await post(
            "/auth/device/challenge",
            body: ChallengeRequest(signingKey: signingKeyB64)
        )
        guard let nonceData = Data(hexString: challenge.nonce),
              nonceData.count == 32 else {
            throw DeviceAuthError.invalidNonce
        }

        let signature = try IdentityService.shared.sign(nonceData)
        let response: VerifyResponse = try await post(
            "/auth/device/verify",
            body: VerifyRequest(
                publicKey: IdentityService.shared.agreementPublicKey.rawRepresentation.base64EncodedString(),
                signingKey: IdentityService.shared.signingPublicKey.rawRepresentation.base64EncodedString(),
                nonce: challenge.nonce,
                signature: signature.base64EncodedString()
            )
        )

        Keychain.save(response.accessToken, forKey: accessKey)
        Keychain.save(response.refreshToken, forKey: refreshKey)
        Keychain.save(response.userID, forKey: seekerKey)
        syncSessionState()
        AuthService.shared.syncSessionState()
    }

    /// Refreshes the device access token if we still have a refresh token.
    func refreshIfNeeded() async throws {
        guard let refreshToken = Keychain.load(forKey: refreshKey) else {
            throw DeviceAuthError.sessionExpired
        }

        let response: RefreshResponse = try await post(
            "/auth/refresh",
            body: RefreshRequest(refreshToken: refreshToken)
        )

        Keychain.save(response.accessToken, forKey: accessKey)
        syncSessionState()
        AuthService.shared.syncSessionState()
    }

    func syncSessionState() {
        isAuthenticated = Keychain.load(forKey: accessKey) != nil
    }

    // MARK: - Networking

    private func post<Body: Encodable, Response: Decodable>(
        _ path: String,
        body: Body
    ) async throws -> Response {
        guard let url = URL(string: baseURL + path) else {
            throw DeviceAuthError.networkFailure("Bad URL")
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await session.data(for: request)
        return try handleResponse(data: data, response: response)
    }

    private func handleResponse<T: Decodable>(data: Data, response: URLResponse) throws -> T {
        guard let http = response as? HTTPURLResponse else {
            throw DeviceAuthError.networkFailure("No response")
        }

        switch http.statusCode {
        case 200...299:
            return try JSONDecoder().decode(T.self, from: data)
        case 401:
            throw DeviceAuthError.sessionExpired
        default:
            let msg = (try? JSONDecoder().decode(ErrorResponse.self, from: data))?.error
                ?? "Server error (\(http.statusCode))"
            throw DeviceAuthError.networkFailure(msg)
        }
    }
}

// MARK: - Request / response types

private struct ChallengeRequest: Encodable {
    let signingKey: String
    enum CodingKeys: String, CodingKey { case signingKey = "signing_key" }
}

private struct ChallengeResponse: Decodable {
    let nonce: String
}

private struct VerifyRequest: Encodable {
    let publicKey: String
    let signingKey: String
    let nonce: String
    let signature: String

    enum CodingKeys: String, CodingKey {
        case publicKey = "public_key"
        case signingKey = "signing_key"
        case nonce
        case signature
    }
}

private struct VerifyResponse: Decodable {
    let accessToken: String
    let refreshToken: String
    let userID: String
    let isNew: Bool

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case userID = "user_id"
        case isNew = "is_new"
    }
}

private struct RefreshRequest: Encodable {
    let refreshToken: String

    enum CodingKeys: String, CodingKey {
        case refreshToken = "refresh_token"
    }
}

private struct RefreshResponse: Decodable {
    let accessToken: String

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
    }
}

private struct ErrorResponse: Decodable {
    let error: String
}

// MARK: - Data helpers

private extension Data {
    init?(hexString: String) {
        let characters = Array(hexString)
        guard characters.count.isMultiple(of: 2) else { return nil }

        var bytes = [UInt8]()
        bytes.reserveCapacity(characters.count / 2)

        var index = 0
        while index < characters.count {
            let high = characters[index]
            let low = characters[index + 1]
            guard
                let highValue = high.hexDigitValue,
                let lowValue = low.hexDigitValue
            else { return nil }

            bytes.append(UInt8(highValue << 4 | lowValue))
            index += 2
        }

        self.init(bytes)
    }
}
