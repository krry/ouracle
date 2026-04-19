import Foundation

actor EeliotAPI {
    private let configuration: EeliotConfiguration
    private let urlSession: URLSession

    init(configuration: EeliotConfiguration, urlSession: URLSession = .shared) {
        self.configuration = configuration
        self.urlSession = urlSession
    }

    func fetchPrompts(build: String?) async throws -> EeliotPromptsResponse {
        let promptsURL = configuration.baseURL.appending(path: "/api/v1/prompts")
        var urlComponents = URLComponents(url: promptsURL, resolvingAgainstBaseURL: false)
        urlComponents?.queryItems = [
            URLQueryItem(name: "app", value: configuration.appSlug),
            URLQueryItem(name: "build", value: build)
        ].compactMap { $0.value == nil ? nil : $0 }

        guard let url = urlComponents?.url else {
            throw EeliotError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 10

        let (data, response) = try await urlSession.data(for: request)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else {
            throw EeliotError.httpError
        }

        return try await MainActor.run { () -> EeliotPromptsResponse in
            try JSONDecoder().decode(EeliotPromptsResponse.self, from: data)
        }
    }

    func postExposure(_ payload: EeliotExposurePayload) async throws {
        let url = configuration.baseURL.appending(path: "/api/v1/exposures")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 10
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(configuration.appSecret, forHTTPHeaderField: "x-eeliot-app-secret")
        let body = try await MainActor.run { try JSONEncoder().encode(payload) }
        request.httpBody = body

        let (_, response) = try await urlSession.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw EeliotError.httpError
        }
    }

    func postResponse(_ payload: EeliotIngestPayload) async throws {
        let url = configuration.baseURL.appending(path: "/api/v1/responses")
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 10
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(configuration.appSecret, forHTTPHeaderField: "x-eeliot-app-secret")
        let body = try await MainActor.run { try JSONEncoder().encode(payload) }
        request.httpBody = body

        let (_, response) = try await urlSession.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw EeliotError.httpError
        }
    }
}

enum EeliotError: Error {
    case invalidURL
    case httpError
}
