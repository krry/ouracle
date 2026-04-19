//
//  ServicesAuthService.swift
//  ouracle
//
//  Token storage and API call coordinator.
//  Auth is bootstrapped via DeviceAuthService on launch; this service
//  manages the resulting tokens and authenticated API surface.
//

import Foundation
import Combine

enum AuthError: LocalizedError {
    case networkFailure(String)
    case sessionExpired

    var errorDescription: String? {
        switch self {
        case .networkFailure(let msg): return msg
        case .sessionExpired: return "Session expired. Please open Ouracle again."
        }
    }
}

enum AuthState: Equatable {
    case unauthenticated
    case authenticated
}

@MainActor
final class AuthService: ObservableObject {

    static let shared = AuthService()

    @Published private(set) var state: AuthState = .unauthenticated

    private let baseURL: String = {
        #if DEBUG
        let env = ProcessInfo.processInfo.environment["OURACLE_API_BASE_URL"]?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if let env, !env.isEmpty { return env }
        #endif
        return "https://api.ouracle.kerry.ink"
    }()

    private let deviceAccessKey  = "device.accessToken"
    private let deviceRefreshKey = "device.refreshToken"
    private let deviceSeekerKey  = "device.seekerID"

    private init() { syncSessionState() }

    // MARK: - Public API

    var isAuthenticated: Bool { state == .authenticated }

    var activeAccessToken: String? {
        Keychain.load(forKey: deviceAccessKey)
    }

    var seekerID: String? {
        Keychain.load(forKey: deviceSeekerKey)
    }

    func refreshIfNeeded() async throws {
        guard let refresh = Keychain.load(forKey: deviceRefreshKey) else {
            state = .unauthenticated
            throw AuthError.sessionExpired
        }
        do {
            let response: RefreshResponse = try await post("/auth/refresh", body: ["refresh_token": refresh])
            Keychain.save(response.accessToken, forKey: deviceAccessKey)
            syncSessionState()
        } catch {
            state = .unauthenticated
            throw AuthError.sessionExpired
        }
    }

    func registerPushToken(_ deviceToken: Data) async {
        let tokenString = deviceToken.map { String(format: "%02x", $0) }.joined()
        guard let accessToken = activeAccessToken else { return }
        guard let url = URL(string: baseURL + "/me/push-token") else { return }
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.httpBody = try? JSONEncoder().encode(["push_token": tokenString])
        _ = try? await URLSession.shared.data(for: request)
    }

    func signOut() async {
        if let access = activeAccessToken {
            try? await delete("/auth/session", accessToken: access)
        }
        Keychain.delete(forKey: deviceAccessKey)
        Keychain.delete(forKey: deviceRefreshKey)
        syncSessionState()
        DeviceAuthService.shared.syncSessionState()
    }

    func syncSessionState() {
        state = activeAccessToken != nil ? .authenticated : .unauthenticated
    }

    // MARK: - Network

    private func post<Body: Encodable, Response: Decodable>(
        _ path: String,
        body: Body
    ) async throws -> Response {
        guard let url = URL(string: baseURL + path) else {
            throw AuthError.networkFailure("Bad URL")
        }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        return try handleResponse(data: data, response: response)
    }

    private func delete(_ path: String, accessToken: String) async throws {
        guard let url = URL(string: baseURL + path) else { return }
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        _ = try? await URLSession.shared.data(for: request)
    }

    private func handleResponse<T: Decodable>(data: Data, response: URLResponse) throws -> T {
        guard let http = response as? HTTPURLResponse else {
            throw AuthError.networkFailure("No response")
        }
        switch http.statusCode {
        case 200...299:
            return try JSONDecoder().decode(T.self, from: data)
        case 401:
            state = .unauthenticated
            throw AuthError.sessionExpired
        default:
            let msg = (try? JSONDecoder().decode(ErrorResponse.self, from: data))?.error
                ?? "Server error (\(http.statusCode))"
            throw AuthError.networkFailure(msg)
        }
    }
}

private struct RefreshResponse: Decodable {
    let accessToken: String
    enum CodingKeys: String, CodingKey { case accessToken = "access_token" }
}

private struct ErrorResponse: Decodable {
    let error: String
}
