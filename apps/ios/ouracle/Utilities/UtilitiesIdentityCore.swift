//
//  UtilitiesIdentityCore.swift
//  souvenir
//
//  Actor-neutral cryptographic identity primitives shared by transport services.
//

import Foundation
import CryptoKit

nonisolated struct DeviceIdentity {
    let agreementPublicKey: Curve25519.KeyAgreement.PublicKey
    let signingPublicKey: Curve25519.Signing.PublicKey
    let fingerprint: Data
    let agreementPrivateKey: Curve25519.KeyAgreement.PrivateKey
    let signingPrivateKey: Curve25519.Signing.PrivateKey

    init(
        agreementPrivateKey: Curve25519.KeyAgreement.PrivateKey,
        signingPrivateKey: Curve25519.Signing.PrivateKey
    ) {
        self.agreementPrivateKey = agreementPrivateKey
        self.signingPrivateKey = signingPrivateKey
        agreementPublicKey = agreementPrivateKey.publicKey
        signingPublicKey = signingPrivateKey.publicKey
        fingerprint = Data(SHA256.hash(data: agreementPublicKey.rawRepresentation))
    }

    func sign(_ data: Data) throws -> Data {
        try signingPrivateKey.signature(for: data)
    }

    static func verify(_ data: Data, signature: Data, publicKey: Curve25519.Signing.PublicKey) -> Bool {
        publicKey.isValidSignature(signature, for: data)
    }
}
