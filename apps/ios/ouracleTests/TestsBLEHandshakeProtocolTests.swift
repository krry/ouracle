import Foundation
import CryptoKit
import Testing
@testable import souvenir

private struct FakeIdentityProvider: BLEHandshakeIdentityProviding {
    let agreementPublicKeyData: Data
    let signingPublicKeyData: Data
    let displayName: String
    let signer: (Data) throws -> Data

    func sign(_ data: Data) throws -> Data {
        try signer(data)
    }
}

@Suite("BLEHandshakeProtocol")
struct BLEHandshakeProtocolTests {

    @Test("local peer snapshot carries identity material")
    func localPeerSnapshot() throws {
        let agreementPair = Curve25519.KeyAgreement.PrivateKey()
        let signingPair = Curve25519.Signing.PrivateKey()
        let identity = FakeIdentityProvider(
            agreementPublicKeyData: agreementPair.publicKey.rawRepresentation,
            signingPublicKeyData: signingPair.publicKey.rawRepresentation,
            displayName: "Moth House",
            signer: { data in try signingPair.signature(for: data) }
        )

        let peer = BLEHandshakeProtocol.makeLocalPeer(from: identity)

        #expect(peer.name == "Moth House")
        #expect(peer.agreementPublicKeyData == agreementPair.publicKey.rawRepresentation)
        #expect(peer.signingPublicKeyData == signingPair.publicKey.rawRepresentation)
        #expect(peer.fingerprint == Data(SHA256.hash(data: agreementPair.publicKey.rawRepresentation)))
    }

    @Test("display name encoding stays valid UTF-8 and caps at 64 bytes")
    func displayNameEncoding() {
        let name = String(repeating: "蝴蝶🌸", count: 20)
        let encoded = BLEHandshakeProtocol.encodeDisplayName(name)

        #expect(encoded.count <= BLEHandshakeProtocol.maxDisplayNameBytes)
        #expect(String(data: encoded, encoding: .utf8) != nil)
    }

    @Test("challenge generation returns 32 bytes")
    func challengeLength() throws {
        let challenge = try BLEHandshakeProtocol.makeChallenge()

        #expect(challenge.count == BLEHandshakeProtocol.challengeLength)
    }

    @Test("challenge generation fails hard when secure random bytes fail")
    func challengeFailure() {
        let original = BLEHandshakeProtocol.randomBytes
        BLEHandshakeProtocol.randomBytes = { _ in .failure(.challengeGenerationFailed(errSecAllocate)) }
        defer { BLEHandshakeProtocol.randomBytes = original }

        do {
            _ = try BLEHandshakeProtocol.makeChallenge()
            Issue.record("Expected BLE challenge generation to fail")
        } catch let error as BLEHandshakeError {
            guard case .challengeGenerationFailed(let status) = error else {
                Issue.record("Unexpected BLE handshake error: \(error.localizedDescription)")
                return
            }
            #expect(status == errSecAllocate)
        } catch {
            Issue.record("Unexpected error: \(error.localizedDescription)")
        }
    }

    @Test("signature verification round-trips")
    func signatureVerification() throws {
        let signingPair = Curve25519.Signing.PrivateKey()
        let challenge = try BLEHandshakeProtocol.makeChallenge()
        let signature = try signingPair.signature(for: challenge)

        #expect(
            BLEHandshakeProtocol.verifySignature(
                challenge: challenge,
                signature: signature,
                signingPublicKeyData: signingPair.publicKey.rawRepresentation
            )
        )
    }

    @Test("signature verification rejects tampering")
    func signatureVerificationRejectsTampering() throws {
        let signingPair = Curve25519.Signing.PrivateKey()
        let challenge = try BLEHandshakeProtocol.makeChallenge()
        var signature = try signingPair.signature(for: challenge)
        signature[0] ^= 0xFF

        #expect(
            BLEHandshakeProtocol.verifySignature(
                challenge: challenge,
                signature: signature,
                signingPublicKeyData: signingPair.publicKey.rawRepresentation
            ) == false
        )
    }

    @Test("acceptance payload is explicit and validated")
    func acceptancePayloadValidation() {
        #expect(BLEHandshakeProtocol.isAcceptancePayload(BLEHandshakeProtocol.acceptancePayload))
        #expect(BLEHandshakeProtocol.isAcceptancePayload(Data([0x00])) == false)
    }

    @Test("peer helper rejects malformed key lengths")
    func malformedPeerKeys() {
        let peer = BLEHandshakeProtocol.peer(
            id: UUID(),
            name: "Broken",
            rssi: nil,
            agreementPublicKeyData: Data(repeating: 0x01, count: 31),
            signingPublicKeyData: Data(repeating: 0x02, count: 32)
        )

        #expect(peer == nil)
    }
}
