//
//  ServicesChatSession.swift
//  ouracle
//
//  Streaming chat session with Clea via POST /enquire (SSE).
//  SSE event shapes:
//    { type: 'token', text: '...' }        — streamed text fragment
//    { type: 'draw', card: { ... } }        — Clea-initiated card draw
//    { type: 'rite', rite: { ... } }        — ritual prescription
//    { type: 'complete', stage: '...' }     — stream finished
//    { type: 'break' }                      — paragraph break
//

import Foundation
import Combine

// MARK: - RiteData

/// A ritual prescription emitted by the server as a `rite` SSE event.
struct RiteData: Identifiable {
    let id: UUID = UUID()
    /// Display name of the rite (e.g. "Threshold Breath").
    let riteName: String
    /// Core action / description of what to do.
    let act: String
    /// Optional spoken invocation or mantra.
    let invocation: String?
    /// Sensory or material textures that accompany the rite.
    let textures: [String]
    /// Optional Sanskrit bija (seed syllable) to be chanted.
    let bija: String?
    /// Optional orientation or directional guidance.
    let orientation: String?
}

// MARK: - Message

struct ChatMessage: Identifiable, Sendable {
    let id: UUID
    let text: String
    let isFromSeeker: Bool
    let timestamp: Date

    init(text: String, isFromSeeker: Bool, timestamp: Date = Date()) {
        self.id = UUID()
        self.text = text
        self.isFromSeeker = isFromSeeker
        self.timestamp = timestamp
    }
}

// MARK: - ChatSession

@MainActor
final class ChatSession: ObservableObject {

    @Published var messages: [ChatMessage] = []
    @Published var isStreaming: Bool = false
    @Published var drawnCard: OracleCard? = nil
    @Published var activeRite: RiteData? = nil
    @Published var lastError: String? = nil  // settable from view for dismiss
    @Published var voiceEnabled: Bool = false
    @Published var needsCovenant: Bool = false

    private var currentSessionID: String?
    private var streamTask: Task<Void, Never>?

    private let baseURL: String = {
        #if DEBUG
        ProcessInfo.processInfo.environment["OURACLE_API_BASE_URL"] ?? "https://api.ouracle.kerry.ink"
        #else
        "https://api.ouracle.kerry.ink"
        #endif
    }()

    init(sessionID: String? = nil) {
        self.currentSessionID = sessionID
    }

    // MARK: - Public API

    func send(_ text: String) {
        let userMessage = ChatMessage(text: text, isFromSeeker: true)
        messages.append(userMessage)

        streamTask?.cancel()
        streamTask = Task { await stream(input: text) }
    }

    func cancel() {
        streamTask?.cancel()
        streamTask = nil
        isStreaming = false
    }

    func dismissCard() {
        drawnCard = nil
    }

    func acceptCovenant() async {
        guard let token = AuthService.shared.activeAccessToken,
              let url = URL(string: baseURL + "/covenant") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: [:])
        _ = try? await URLSession.shared.data(for: req)
        needsCovenant = false
        send("I accept the covenant.")
    }

    // MARK: - Streaming

    private func stream(input: String) async {
        guard let url = URL(string: baseURL + "/enquire") else { return }
        guard let token = AuthService.shared.activeAccessToken else {
            lastError = "not authenticated"
            isStreaming = false
            return
        }

        var body: [String: Any] = ["message": input]
        if let sid = currentSessionID { body["session_id"] = sid }
        if voiceEnabled {
            let isCellular = NetworkMonitor.shared.isCellular
            body["voice_context"] = [
                "enabled": true,
                "bandwidth": isCellular ? "cellular" : "wifi",
            ]
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("text/event-stream", forHTTPHeaderField: "Accept")
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        isStreaming = true
        lastError = nil
        var accumulated = ""

        do {
            let (bytes, response) = try await URLSession.shared.bytes(for: request)
            if let http = response as? HTTPURLResponse, http.statusCode != 200 {
                lastError = "API error \(http.statusCode)"
                isStreaming = false
                return
            }
            for try await line in bytes.lines {
                if Task.isCancelled { break }
                guard line.hasPrefix("data:") else { continue }
                let payload = String(line.dropFirst(5)).trimmingCharacters(in: .whitespaces)
                if payload == "[DONE]" { break }

                guard let data = payload.data(using: .utf8),
                      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let type = json["type"] as? String else { continue }

                switch type {
                case "token":
                    if let text = json["text"] as? String {
                        accumulated += text
                        updateOrAppendCleaMessage(accumulated)
                    }
                case "sentence_text":
                    if let text = json["text"] as? String {
                        let isFinal = json["isFinal"] as? Bool ?? false
                        accumulated += text
                        if !isFinal { accumulated += " " }
                        updateOrAppendCleaMessage(accumulated.trimmingCharacters(in: .whitespaces))
                    }
                case "break":
                    accumulated += "\n"
                    updateOrAppendCleaMessage(accumulated)
                case "session":
                    if let sid = json["session_id"] as? String {
                        currentSessionID = sid
                    }
                    if let nc = json["needs_covenant"] as? Bool {
                        needsCovenant = nc
                    }
                case "draw":
                    if let cardJSON = json["card"] as? [String: Any],
                       let card = DeckService.shared.card(from: cardJSON) {
                        drawnCard = card
                    }
                case "rite":
                    if let riteJSON = json["rite"] as? [String: Any],
                       let riteName = riteJSON["rite_name"] as? String,
                       let act = riteJSON["act"] as? String {
                        activeRite = RiteData(
                            riteName: riteName,
                            act: act,
                            invocation: riteJSON["invocation"] as? String,
                            textures: riteJSON["textures"] as? [String] ?? [],
                            bija: riteJSON["bija"] as? String,
                            orientation: riteJSON["orientation"] as? String
                        )
                    }
                case "complete", "vagal", "belief", "quality", "affect",
                     "sentence_audio", "sentence_audio_missing":
                    break
                default:
                    break
                }
            }
        } catch {
            if !Task.isCancelled {
                lastError = error.localizedDescription
                print("[ChatSession] stream error: \(error)")
            }
        }

        isStreaming = false
    }

    private func updateOrAppendCleaMessage(_ text: String) {
        if let last = messages.last, !last.isFromSeeker {
            messages[messages.count - 1] = ChatMessage(
                text: text,
                isFromSeeker: false,
                timestamp: last.timestamp
            )
        } else {
            messages.append(ChatMessage(text: text, isFromSeeker: false))
        }
    }
}
