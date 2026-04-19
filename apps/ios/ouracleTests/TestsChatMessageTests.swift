//
//  TestsChatMessageTests.swift
//  souvenirTests
//
//  Unit tests for ChatMessage and ChatPayload — pure struct tests, no Core Data, no async.
//

import Foundation
import Testing
@testable import souvenir

@Suite("ChatMessage Tests")
struct TestsChatMessageTests {

    // MARK: - ChatMessage

    @Test("Two ChatMessages with identical text have distinct IDs")
    func chatMessage_uniqueIDs() {
        let a = ChatMessage(text: "hello", isFromSelf: true)
        let b = ChatMessage(text: "hello", isFromSelf: true)
        #expect(a.id != b.id)
    }

    @Test("isFromSelf is preserved on init")
    func chatMessage_isFromSelf() {
        let fromSelf = ChatMessage(text: "hi", isFromSelf: true)
        let fromOther = ChatMessage(text: "hi", isFromSelf: false)
        #expect(fromSelf.isFromSelf == true)
        #expect(fromOther.isFromSelf == false)
    }

    @Test("ChatMessage timestamp defaults close to now")
    func chatMessage_timestampDefault() {
        let before = Date()
        let message = ChatMessage(text: "ping", isFromSelf: true)
        let after = Date()
        #expect(message.timestamp >= before)
        #expect(message.timestamp <= after)
    }

    // MARK: - ChatPayload

    @Test("ChatPayload round-trips through JSON")
    func chatPayload_jsonRoundTrip() throws {
        let ts = Date().timeIntervalSince1970 * 1000
        let original = ChatPayload(text: "round trip", ts: ts)

        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(ChatPayload.self, from: data)

        #expect(decoded.text == original.text)
        #expect(decoded.ts == original.ts)
    }

    @Test("ChatPayload encodes emoji and unicode correctly")
    func chatPayload_specialCharacters() throws {
        let text = "こんにちは 🌸 café naïve résumé"
        let payload = ChatPayload(text: text, ts: 1_700_000_000_000)

        let data = try JSONEncoder().encode(payload)
        let decoded = try JSONDecoder().decode(ChatPayload.self, from: data)

        #expect(decoded.text == text)
    }

    @Test("ChatPayload encodes 4000-character text without loss")
    func chatPayload_longText() throws {
        let longText = String(repeating: "a", count: 4000)
        let payload = ChatPayload(text: longText, ts: 0)

        let data = try JSONEncoder().encode(payload)
        let decoded = try JSONDecoder().decode(ChatPayload.self, from: data)

        #expect(decoded.text == longText)
        #expect(decoded.text.count == 4000)
    }
}
