//
//  TestsTransferFrameCodecTests.swift
//  souvenirTests
//
//  Unit tests for the P2P photo transfer frame codec.
//

import Foundation
import Testing
import CryptoKit
@testable import souvenir

@Suite("TransferFrameCodec")
struct TransferFrameCodecTests {

    // MARK: - Encode / decode round-trips

    @Test("manifest frame round-trips")
    func manifestRoundTrip() throws {
        let payload = Data("hello".utf8)
        let encoded = TransferFrameCodec.encode(.manifest, totalChunks: 42, payload: payload)
        let frame = try #require(TransferFrameCodec.decode(encoded))

        #expect(frame.type == .manifest)
        #expect(frame.photoIndex == 0)
        #expect(frame.chunkIndex == 0)
        #expect(frame.totalChunks == 42)
        #expect(frame.payload == payload)
    }

    @Test("chunk frame round-trips with all header fields")
    func chunkRoundTrip() throws {
        let payload = Data(repeating: 0xAB, count: 512)
        let encoded = TransferFrameCodec.encode(.chunk, photoIndex: 1, chunkIndex: 7, totalChunks: 100, payload: payload)
        let frame = try #require(TransferFrameCodec.decode(encoded))

        #expect(frame.type == .chunk)
        #expect(frame.photoIndex == 1)
        #expect(frame.chunkIndex == 7)
        #expect(frame.totalChunks == 100)
        #expect(frame.payload == payload)
    }

    @Test("done and ack frames carry no payload")
    func controlFrames() throws {
        for type in [TransferFrameType.done, .ack, .cancel] {
            let encoded = TransferFrameCodec.encode(type)
            let frame = try #require(TransferFrameCodec.decode(encoded))
            #expect(frame.type == type)
            #expect(frame.payload.isEmpty)
        }
    }

    @Test("uint32 header values survive big-endian encoding")
    func bigEndianBoundary() throws {
        let big: UInt32 = 0xDEADBEEF
        let encoded = TransferFrameCodec.encode(.chunk, photoIndex: big, chunkIndex: big, totalChunks: big)
        let frame = try #require(TransferFrameCodec.decode(encoded))
        #expect(frame.photoIndex == big)
        #expect(frame.chunkIndex == big)
        #expect(frame.totalChunks == big)
    }

    // MARK: - Malformed input

    @Test("decode returns nil for data shorter than 13 bytes")
    func decodeTooShort() {
        #expect(TransferFrameCodec.decode(Data()) == nil)
        #expect(TransferFrameCodec.decode(Data(repeating: 0, count: 12)) == nil)
    }

    @Test("decode returns nil for unknown frame type byte")
    func decodeUnknownType() {
        var data = Data(repeating: 0, count: 13)
        data[0] = 0xFF  // not a valid TransferFrameType
        #expect(TransferFrameCodec.decode(data) == nil)
    }

    @Test("exact 13-byte frame has empty payload")
    func decodeExactHeader() throws {
        let data = Data(repeating: 0, count: 13)  // type = .manifest (0)
        let frame = try #require(TransferFrameCodec.decode(data))
        #expect(frame.type == .manifest)
        #expect(frame.payload.isEmpty)
    }

    // MARK: - Chunking

    @Test("chunk splits data into correct sizes")
    func chunkSizes() {
        let data = Data(repeating: 0x01, count: 1000)
        let chunks = TransferFrameCodec.chunk(data, size: 300)

        #expect(chunks.count == 4)
        #expect(chunks[0].count == 300)
        #expect(chunks[1].count == 300)
        #expect(chunks[2].count == 300)
        #expect(chunks[3].count == 100)  // remainder
    }

    @Test("chunk reassembly is lossless")
    func chunkReassembly() {
        let original = Data((0 ..< 1000).map { UInt8($0 % 256) })
        let chunks = TransferFrameCodec.chunk(original, size: 64)
        let reassembled = chunks.reduce(Data()) { $0 + $1 }
        #expect(reassembled == original)
    }

    @Test("chunk of empty data returns empty array")
    func chunkEmpty() {
        #expect(TransferFrameCodec.chunk(Data(), size: 100).isEmpty)
    }

    @Test("chunk data smaller than chunk size returns one chunk")
    func chunkSmallerThanSize() {
        let data = Data(repeating: 0x42, count: 50)
        let chunks = TransferFrameCodec.chunk(data, size: 100)
        #expect(chunks.count == 1)
        #expect(chunks[0] == data)
    }

    // MARK: - Manifest JSON

    @Test("TransferManifest encodes and decodes symmetrically")
    func manifestJSON() throws {
        let original = TransferManifest(
            photoCount: 1,
            totalBytes: 123_456,
            contactName: "Rosalind Franklin",
            timestamp: 1_741_450_000_000,
            signature: nil
        )
        let encoded = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(TransferManifest.self, from: encoded)

        #expect(decoded.photoCount == original.photoCount)
        #expect(decoded.totalBytes == original.totalBytes)
        #expect(decoded.contactName == original.contactName)
        #expect(decoded.timestamp == original.timestamp)
    }
}

@Suite("TransferManifest signing")
struct TransferManifestSigningTests {

    @Test("unsigned manifest encodes and decodes cleanly")
    func unsignedRoundTrip() throws {
        let manifest = TransferManifest(
            photoCount: 1, totalBytes: 5000,
            contactName: "Ada Lovelace",
            timestamp: 1_700_000_000_000,
            signature: nil
        )
        let data = try JSONEncoder().encode(manifest)
        let decoded = try JSONDecoder().decode(TransferManifest.self, from: data)
        #expect(decoded.contactName == "Ada Lovelace")
        #expect(decoded.signature == nil)
    }

    @Test("signed manifest survives encode/decode")
    func signedRoundTrip() throws {
        let manifest = TransferManifest(
            photoCount: 1, totalBytes: 8000,
            contactName: "Grace Hopper",
            timestamp: 1_700_000_000_000,
            signature: nil
        )
        let signed = try manifest.signed(with: IdentityService.shared)
        #expect(signed.signature != nil)

        let data = try JSONEncoder().encode(signed)
        let decoded = try JSONDecoder().decode(TransferManifest.self, from: data)
        #expect(decoded.signature == signed.signature)
    }

    @Test("valid signature verifies")
    func verifyValid() throws {
        let manifest = TransferManifest(
            photoCount: 1, totalBytes: 9000,
            contactName: "Hedy Lamarr",
            timestamp: 1_700_000_000_001,
            signature: nil
        )
        let signed = try manifest.signed(with: IdentityService.shared)
        let pubKey = IdentityService.shared.signingPublicKey
        #expect(signed.verify(with: pubKey) == true)
    }

    @Test("tampered totalBytes fails verification")
    func verifyTamperedTotalBytes() throws {
        let manifest = TransferManifest(
            photoCount: 1, totalBytes: 9000,
            contactName: "Katherine Johnson",
            timestamp: 1_700_000_000_003,
            signature: nil
        )
        let signed = try manifest.signed(with: IdentityService.shared)
        let tampered = TransferManifest(
            photoCount: 1, totalBytes: 99999,  // mutated
            contactName: "Katherine Johnson",
            timestamp: 1_700_000_000_003,
            signature: signed.signature
        )
        let pubKey = IdentityService.shared.signingPublicKey
        #expect(tampered.verify(with: pubKey) == false)
    }

    @Test("tampered name fails verification")
    func verifyTampered() throws {
        let manifest = TransferManifest(
            photoCount: 1, totalBytes: 9000,
            contactName: "Joan Clarke",
            timestamp: 1_700_000_000_002,
            signature: nil
        )
        let signed = try manifest.signed(with: IdentityService.shared)
        let tampered = TransferManifest(
            photoCount: 1, totalBytes: 9000,
            contactName: "ATTACKER",
            timestamp: 1_700_000_000_002,
            signature: signed.signature
        )
        let pubKey = IdentityService.shared.signingPublicKey
        #expect(tampered.verify(with: pubKey) == false)
    }
}
