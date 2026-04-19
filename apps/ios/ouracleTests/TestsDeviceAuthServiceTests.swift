import Testing
import Foundation
import CryptoKit
@preconcurrency @testable import souvenir

@MainActor
@Suite("Device Auth Service Tests")
struct TestsDeviceAuthServiceTests {

    private let testBaseURL = "https://example.test/v1"

    init() {
        clearKeychain()
        AuthService.shared.syncSessionState()
    }

    private func clearKeychain() {
        [
            "auth.accessToken",
            "auth.refreshToken",
            "device.accessToken",
            "device.refreshToken",
        ].forEach(Keychain.delete(forKey:))
    }

    private func makeSession(
        handler: @escaping (URLRequest) throws -> (HTTPURLResponse, Data)
    ) -> (session: URLSession, handlerID: String) {
        let handlerID = UUID().uuidString
        MockURLProtocol.registerHandler(handler, id: handlerID)

        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        config.httpAdditionalHeaders = [MockURLProtocol.handlerHeader: handlerID]
        return (URLSession(configuration: config), handlerID)
    }

    @Test("authenticate stores device tokens and marks the app authenticated")
    func authenticateStoresTokens() async throws {
        defer {
            clearKeychain()
            AuthService.shared.syncSessionState()
        }

        let nonce = String(repeating: "ab", count: 32)
        let accessToken = "device-access-token"
        let refreshToken = "device-refresh-token"

        let (session, handlerID) = makeSession { request in
            guard let url = request.url else {
                throw NSError(domain: "test", code: -1)
            }

            if url.absoluteString == "\(testBaseURL)/auth/device/challenge" {
                let body = Data(#"{"nonce":"\#(nonce)"}"#.utf8)
                let response = HTTPURLResponse(
                    url: url,
                    statusCode: 200,
                    httpVersion: nil,
                    headerFields: ["Content-Type": "application/json"]
                )!
                return (response, body)
            }

            if url.absoluteString == "\(testBaseURL)/auth/device/verify" {
                let body = try JSONSerialization.jsonObject(with: request.bodyData()) as? [String: Any]
                #expect(body?["public_key"] as? String == IdentityService.shared.agreementPublicKey.rawRepresentation.base64EncodedString())
                #expect(body?["signing_key"] as? String == IdentityService.shared.signingPublicKey.rawRepresentation.base64EncodedString())
                #expect(body?["nonce"] as? String == nonce)
                #expect(((body?["signature"] as? String)?.isEmpty ?? true) == false)

                let responseBody = Data(
                    #"{"access_token":"\#(accessToken)","refresh_token":"\#(refreshToken)","user_id":"user-123","is_new":true}"#.utf8
                )
                let response = HTTPURLResponse(
                    url: url,
                    statusCode: 200,
                    httpVersion: nil,
                    headerFields: ["Content-Type": "application/json"]
                )!
                return (response, responseBody)
            }

            throw NSError(
                domain: "test",
                code: -2,
                userInfo: [NSLocalizedDescriptionKey: "Unexpected URL: \(url.absoluteString)"]
            )
        }
        defer { MockURLProtocol.removeHandler(id: handlerID) }

        let service = DeviceAuthService(session: session, baseURL: testBaseURL)
        try await service.authenticate()

        #expect(Keychain.load(forKey: "device.accessToken") == accessToken)
        #expect(Keychain.load(forKey: "device.refreshToken") == refreshToken)
        #expect(AuthService.shared.isAuthenticated)
    }

    @Test("refreshIfNeeded refreshes the device access token")
    func refreshesToken() async throws {
        defer {
            clearKeychain()
            AuthService.shared.syncSessionState()
        }

        Keychain.save("stale-device-access", forKey: "device.accessToken")
        Keychain.save("device-refresh-token", forKey: "device.refreshToken")
        AuthService.shared.syncSessionState()

        let (session, handlerID) = makeSession { request in
            guard let url = request.url else {
                throw NSError(domain: "test", code: -1)
            }

            if url.absoluteString == "\(testBaseURL)/auth/refresh" {
                let body = Data(#"{"access_token":"fresh-device-access"}"#.utf8)
                let response = HTTPURLResponse(
                    url: url,
                    statusCode: 200,
                    httpVersion: nil,
                    headerFields: ["Content-Type": "application/json"]
                )!
                return (response, body)
            }

            throw NSError(
                domain: "test",
                code: -2,
                userInfo: [NSLocalizedDescriptionKey: "Unexpected URL: \(url.absoluteString)"]
            )
        }
        defer { MockURLProtocol.removeHandler(id: handlerID) }

        let service = DeviceAuthService(session: session, baseURL: testBaseURL)
        try await service.refreshIfNeeded()

        #expect(Keychain.load(forKey: "device.accessToken") == "fresh-device-access")
        #expect(AuthService.shared.activeAccessToken == "fresh-device-access")
    }

    @Test("phone access token takes precedence over device access token")
    func activeAccessTokenPrefersPhone() {
        defer {
            clearKeychain()
            AuthService.shared.syncSessionState()
        }

        Keychain.save("phone-access", forKey: "auth.accessToken")
        Keychain.save("device-access", forKey: "device.accessToken")
        AuthService.shared.syncSessionState()

        #expect(AuthService.shared.activeAccessToken == "phone-access")
    }

    @Test("authenticate rejects nonces with the wrong byte length")
    func authenticateRejectsWrongNonceLength() async throws {
        defer {
            clearKeychain()
            AuthService.shared.syncSessionState()
        }

        let shortNonce = String(repeating: "ab", count: 16)

        let (session, handlerID) = makeSession { request in
            guard let url = request.url else {
                throw NSError(domain: "test", code: -1)
            }

            if url.absoluteString == "\(testBaseURL)/auth/device/challenge" {
                let body = Data(#"{"nonce":"\#(shortNonce)"}"#.utf8)
                let response = HTTPURLResponse(
                    url: url,
                    statusCode: 200,
                    httpVersion: nil,
                    headerFields: ["Content-Type": "application/json"]
                )!
                return (response, body)
            }

            throw NSError(
                domain: "test",
                code: -2,
                userInfo: [NSLocalizedDescriptionKey: "Unexpected URL: \(url.absoluteString)"]
            )
        }
        defer { MockURLProtocol.removeHandler(id: handlerID) }

        let service = DeviceAuthService(session: session, baseURL: testBaseURL)

        do {
            try await service.authenticate()
            Issue.record("Expected invalid nonce error")
        } catch let error as DeviceAuthError {
            guard case .invalidNonce = error else {
                Issue.record("Unexpected device auth error: \(error.localizedDescription)")
                return
            }
        } catch {
            Issue.record("Unexpected error: \(error.localizedDescription)")
        }
    }
}

final class MockURLProtocol: URLProtocol {

    static let handlerHeader = "X-Mock-Session-ID"

    private static var handlers: [String: (URLRequest) throws -> (HTTPURLResponse, Data)] = [:]

    static func registerHandler(
        _ handler: @escaping (URLRequest) throws -> (HTTPURLResponse, Data),
        id: String
    ) {
        handlers[id] = handler
    }

    static func removeHandler(id: String) {
        handlers[id] = nil
    }

    override class func canInit(with request: URLRequest) -> Bool {
        true
    }

    override class func canonicalRequest(for request: URLRequest) -> URLRequest {
        request
    }

    override func startLoading() {
        guard let handlerID = request.value(forHTTPHeaderField: Self.handlerHeader),
              let handler = Self.handlers[handlerID] else {
            client?.urlProtocol(self, didFailWithError: NSError(domain: "test", code: -99))
            return
        }

        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

private extension URLRequest {
    func bodyData() -> Data {
        if let httpBody {
            return httpBody
        }

        guard let stream = httpBodyStream else {
            return Data()
        }

        stream.open()
        defer { stream.close() }

        var data = Data()
        let bufferSize = 1024
        let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
        defer { buffer.deallocate() }

        while stream.hasBytesAvailable {
            let read = stream.read(buffer, maxLength: bufferSize)
            guard read > 0 else { break }
            data.append(buffer, count: read)
        }

        return data
    }
}
