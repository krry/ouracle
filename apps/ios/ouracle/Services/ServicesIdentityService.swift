//
//  ServicesIdentityService.swift
//  souvenir
//
//  Manages the device's permanent cryptographic identity.
//  Two keypairs are generated on first launch and persisted in the Keychain:
//    - agreementKeyPair: Curve25519 ECDH (key exchange)
//    - signingKeyPair:   Curve25519 Ed25519 (message signing)
//
//  The `fingerprint` (SHA256 of agreement public key) is the shareable
//  identity token — safe to display and store on ContactEntity.
//

import Foundation
import CryptoKit

final class IdentityService {

    nonisolated static let shared = IdentityService()

    private let deviceIdentity: DeviceIdentity

    // MARK: - Public key material

    let agreementPublicKey: Curve25519.KeyAgreement.PublicKey
    let signingPublicKey: Curve25519.Signing.PublicKey

    /// 32-byte SHA256 of agreementPublicKey.rawRepresentation.
    let fingerprint: Data

    // MARK: - Private key material (kept in memory after Keychain load)

    let agreementPrivateKey: Curve25519.KeyAgreement.PrivateKey
    private let signingPrivateKey: Curve25519.Signing.PrivateKey

    // MARK: - Init

    private init() {
        let agreement = Self.loadOrGenerate(
            keychainKey: "identity.agreement",
            generate: { Curve25519.KeyAgreement.PrivateKey() },
            serialize: { $0.rawRepresentation },
            deserialize: { try Curve25519.KeyAgreement.PrivateKey(rawRepresentation: $0) }
        )
        let signing = Self.loadOrGenerate(
            keychainKey: "identity.signing",
            generate: { Curve25519.Signing.PrivateKey() },
            serialize: { $0.rawRepresentation },
            deserialize: { try Curve25519.Signing.PrivateKey(rawRepresentation: $0) }
        )

        let deviceIdentity = DeviceIdentity(
            agreementPrivateKey: agreement,
            signingPrivateKey: signing
        )
        self.deviceIdentity = deviceIdentity
        agreementPrivateKey = deviceIdentity.agreementPrivateKey
        signingPrivateKey = deviceIdentity.signingPrivateKey
        agreementPublicKey = deviceIdentity.agreementPublicKey
        signingPublicKey = deviceIdentity.signingPublicKey
        fingerprint = deviceIdentity.fingerprint
    }

    // MARK: - Signing

    /// Sign arbitrary data. Returns the 64-byte Ed25519 signature.
    nonisolated func sign(_ data: Data) throws -> Data {
        try deviceIdentity.sign(data)
    }

    /// Verify an Ed25519 signature against a known public key.
    nonisolated static func verify(_ data: Data, signature: Data, publicKey: Curve25519.Signing.PublicKey) -> Bool {
        DeviceIdentity.verify(data, signature: signature, publicKey: publicKey)
    }

    // MARK: - Keychain helpers

    private static func loadOrGenerate<Key>(
        keychainKey: String,
        generate: () -> Key,
        serialize: (Key) -> Data,
        deserialize: (Data) throws -> Key
    ) -> Key {
        if let raw = Keychain.loadData(forKey: keychainKey),
           let key = try? deserialize(raw) {
            return key
        }
        let key = generate()
        Keychain.save(serialize(key), forKey: keychainKey)
        return key
    }
}
