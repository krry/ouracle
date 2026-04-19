//
//  ServicesChatSession.swift
//  ouracle
//
//  Streaming chat session with Clea via POST /enquire (SSE).
//  SSE event shapes:
//    { type: 'token', text: '...' }        — streamed text fragment
//    { type: 'draw', card: { ... } }        — Clea-initiated card draw
//    { type: 'complete', stage: '...' }     — stream finished
//    { type: 'break' }                      — paragraph break
//

import Foundation
import Combine

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
    @Published var lastError: String? = nil  // settable from view for dismiss

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
                case "break":
                    accumulated += "\n"
                    updateOrAppendCleaMessage(accumulated)
                case "session":
                    if let sid = json["session_id"] as? String {
                        currentSessionID = sid
                    }
                case "draw":
                    if let cardJSON = json["card"] as? [String: Any],
                       let card = DeckService.shared.card(from: cardJSON) {
                        drawnCard = card
                    }
                case "complete", "rite", "vagal", "belief", "quality", "affect":
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
