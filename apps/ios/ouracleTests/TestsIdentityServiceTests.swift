import Testing
import Foundation
import CryptoKit
@testable import souvenir

@Suite("Keychain Data overloads")
struct KeychainDataTests {

    @Test("round-trips binary Data")
    func roundTrip() {
        let key = "test.keychain.data.\(UUID().uuidString)"
        let original = Data([0x01, 0x02, 0x03, 0xAB, 0xFF])
        Keychain.save(original, forKey: key)
        let loaded = Keychain.loadData(forKey: key)
        Keychain.delete(forKey: key)
        #expect(loaded == original)
    }

    @Test("returns nil for missing key")
    func missingKey() {
        #expect(Keychain.loadData(forKey: "test.keychain.notexist") == nil)
    }

    @Test("second save overwrites first")
    func overwrite() {
        let key = "test.keychain.overwrite.\(UUID().uuidString)"
        let first = Data([0x01, 0x02, 0x03])
        let second = Data([0xAA, 0xBB, 0xCC, 0xDD])
        Keychain.save(first, forKey: key)
        Keychain.save(second, forKey: key)
        let loaded = Keychain.loadData(forKey: key)
        Keychain.delete(forKey: key)
        #expect(loaded == second)
    }
}

@Suite("IdentityService")
struct IdentityServiceTests {

    @Test("generates stable keypair across accesses")
    func stableKeypair() {
        let pub1 = IdentityService.shared.agreementPublicKey
        let pub2 = IdentityService.shared.agreementPublicKey
        #expect(pub1.rawRepresentation == pub2.rawRepresentation)
    }

    @Test("fingerprint is 32 bytes")
    func fingerprintLength() {
        #expect(IdentityService.shared.fingerprint.count == 32)
    }

    @Test("fingerprint matches SHA256 of public key")
    func fingerprintDerivation() {
        let pubKey = IdentityService.shared.agreementPublicKey
        let expected = Data(SHA256.hash(data: pubKey.rawRepresentation))
        #expect(IdentityService.shared.fingerprint == expected)
    }

    @Test("sign and verify round-trip")
    func signVerify() throws {
        let message = Data("hello svnr".utf8)
        let signature = try IdentityService.shared.sign(message)
        let pubKey = IdentityService.shared.signingPublicKey
        let valid = IdentityService.verify(message, signature: signature, publicKey: pubKey)
        #expect(valid == true)
    }

    @Test("verify rejects tampered message")
    func verifyRejectsTampered() throws {
        let message = Data("hello svnr".utf8)
        let signature = try IdentityService.shared.sign(message)
        let tampered = Data("hello TAMPERED".utf8)
        let pubKey = IdentityService.shared.signingPublicKey
        let valid = IdentityService.verify(tampered, signature: signature, publicKey: pubKey)
        #expect(valid == false)
    }
}
