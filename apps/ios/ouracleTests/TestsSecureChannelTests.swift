import Testing
import CryptoKit
import Foundation
@testable import souvenir

@Suite("SecureChannel")
struct SecureChannelTests {

    @Test("encrypt/decrypt round-trips arbitrary data")
    func roundTrip() throws {
        let alicePriv = Curve25519.KeyAgreement.PrivateKey()
        let bobPriv = Curve25519.KeyAgreement.PrivateKey()

        let aliceChannel = try SecureChannel(
            localPrivateKey: alicePriv,
            peerPublicKey: bobPriv.publicKey
        )
        let bobChannel = try SecureChannel(
            localPrivateKey: bobPriv,
            peerPublicKey: alicePriv.publicKey
        )

        let plaintext = Data("this is a souvenir photo payload".utf8)
        let ciphertext = try aliceChannel.encrypt(plaintext)
        let decrypted = try bobChannel.decrypt(ciphertext)
        #expect(decrypted == plaintext)
    }

    @Test("ciphertext is longer than plaintext")
    func ciphertextSize() throws {
        let priv1 = Curve25519.KeyAgreement.PrivateKey()
        let priv2 = Curve25519.KeyAgreement.PrivateKey()
        let channel = try SecureChannel(localPrivateKey: priv1, peerPublicKey: priv2.publicKey)
        let plaintext = Data(repeating: 0xAB, count: 100)
        let ciphertext = try channel.encrypt(plaintext)
        // 12 nonce + 100 data + 16 tag = 128
        #expect(ciphertext.count == 128)
    }

    @Test("decrypt rejects tampered ciphertext")
    func tamperDetection() throws {
        let priv1 = Curve25519.KeyAgreement.PrivateKey()
        let priv2 = Curve25519.KeyAgreement.PrivateKey()
        let alice = try SecureChannel(localPrivateKey: priv1, peerPublicKey: priv2.publicKey)
        let bob = try SecureChannel(localPrivateKey: priv2, peerPublicKey: priv1.publicKey)

        let plaintext = Data("souvenir".utf8)
        var ciphertext = try alice.encrypt(plaintext)
        // Flip a byte in the ciphertext body (after the 12-byte nonce)
        ciphertext[15] ^= 0xFF

        #expect(throws: (any Error).self) {
            try bob.decrypt(ciphertext)
        }
    }

    @Test("same session key from both sides (ECDH symmetry)")
    func symmetricKey() throws {
        let priv1 = Curve25519.KeyAgreement.PrivateKey()
        let priv2 = Curve25519.KeyAgreement.PrivateKey()

        let ch1 = try SecureChannel(localPrivateKey: priv1, peerPublicKey: priv2.publicKey)
        let ch2 = try SecureChannel(localPrivateKey: priv2, peerPublicKey: priv1.publicKey)

        let data = Data("symmetric check".utf8)
        let ct = try ch2.encrypt(data)
        let pt = try ch1.decrypt(ct)
        #expect(pt == data)
    }
}
