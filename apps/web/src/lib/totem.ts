// totem.ts — E2E encrypted Totem via WebCrypto
// ECDH P-256 keypairs + AES-GCM 256. Private key in IndexedDB, never leaves client.

const DB_NAME = 'ouracle';
const STORE = 'keys';
const KEY_ID = 'totem-private-key';

export interface TotemData {
  v: number;
  seeker_id: string;
  updated_at: string;
  name: string;
  arc: string;
  qualities: { dominant: string; current: string };
  beliefs: string[];
  rites: Array<{ name: string; act: string; at: string }>;
  sessions: Array<{
    id: string;
    session_id?: string;
    at: string;
    quality?: string;
    note?: string;
    feedback?: string;
    context?: string;
    rite_name?: string;
    beliefs?: string[];
    current_state?: string;
    dominant_quality?: string;
  }>;
  context: string;
}

// ── IndexedDB ────────────────────────────────────────────────────────────────

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<CryptoKey | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, key: string, value: CryptoKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Device keypair ───────────────────────────────────────────────────────────

export async function generateDeviceKeyPair(): Promise<{ publicKeyJwk: JsonWebKey; privateKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false, // private key non-extractable
    ['deriveKey']
  );
  const publicKeyJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  return { publicKeyJwk, privateKey: pair.privateKey };
}

export async function storePrivateKey(privateKey: CryptoKey): Promise<void> {
  const db = await openDb();
  await idbPut(db, KEY_ID, privateKey);
}

export async function loadPrivateKey(): Promise<CryptoKey | null> {
  const db = await openDb();
  return (await idbGet(db, KEY_ID)) ?? null;
}

// ── AES-GCM helpers ──────────────────────────────────────────────────────────

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

async function aesEncrypt(key: CryptoKey, plaintext: Uint8Array<ArrayBuffer>): Promise<{ iv: Uint8Array<ArrayBuffer>; ciphertext: ArrayBuffer }> {
  const iv = randomBytes(12) as Uint8Array<ArrayBuffer>;
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return { iv, ciphertext };
}

async function aesDecrypt(key: CryptoKey, iv: Uint8Array<ArrayBuffer>, ciphertext: BufferSource): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
}

function toBase64(buf: ArrayBuffer | Uint8Array<ArrayBuffer>): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf instanceof ArrayBuffer ? buf : buf.buffer)));
}

function fromBase64(s: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;
}

// ── Totem key (AES-GCM 256) ──────────────────────────────────────────────────

async function generateTotemKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

async function exportTotemKey(totemKey: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey('raw', totemKey);
}

async function importTotemKey(raw: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

export async function exportTotemKeyBase64(totemKey: CryptoKey): Promise<string> {
  return toBase64(await exportTotemKey(totemKey));
}

// ── ECDH key wrapping ─────────────────────────────────────────────────────────

async function deriveWrappingKey(privateKey: CryptoKey, publicKeyJwk: JsonWebKey): Promise<CryptoKey> {
  const publicKey = await crypto.subtle.importKey(
    'jwk', publicKeyJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  );
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: publicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function wrapTotemKey(totemKey: CryptoKey, devicePublicKeyJwk: JsonWebKey, devicePrivateKey: CryptoKey): Promise<string> {
  const wrappingKey = await deriveWrappingKey(devicePrivateKey, devicePublicKeyJwk);
  const raw = await exportTotemKey(totemKey);
  const { iv, ciphertext } = await aesEncrypt(wrappingKey, new Uint8Array(raw));
  return JSON.stringify({ iv: toBase64(iv), ct: toBase64(ciphertext) });
}

export async function unwrapTotemKey(wrappedKeyJson: string, devicePublicKeyJwk: JsonWebKey, devicePrivateKey: CryptoKey): Promise<CryptoKey> {
  const { iv, ct } = JSON.parse(wrappedKeyJson);
  const wrappingKey = await deriveWrappingKey(devicePrivateKey, devicePublicKeyJwk);
  const raw = await aesDecrypt(wrappingKey, fromBase64(iv), fromBase64(ct));
  return importTotemKey(raw);
}

// ── Totem encrypt/decrypt ────────────────────────────────────────────────────

export async function encryptTotem(data: TotemData, totemKey: CryptoKey): Promise<string> {
  const plain = new TextEncoder().encode(JSON.stringify(data));
  const { iv, ciphertext } = await aesEncrypt(totemKey, plain);
  return JSON.stringify({ iv: toBase64(iv), ct: toBase64(ciphertext) });
}

export async function decryptTotem(ciphertextJson: string, totemKey: CryptoKey): Promise<TotemData> {
  const { iv, ct } = JSON.parse(ciphertextJson);
  const plain = await aesDecrypt(totemKey, fromBase64(iv), fromBase64(ct));
  return JSON.parse(new TextDecoder().decode(plain)) as TotemData;
}

// ── Distillation decrypt ─────────────────────────────────────────────────────
// Server sends {encrypted_distillation, ephemeral_public_key} — we decrypt using
// our device private key and the server's ephemeral public key.

export async function decryptDistillation(
  encryptedB64: string,
  ephemeralPublicKeyJwk: JsonWebKey
): Promise<string> {
  const privateKey = await loadPrivateKey();
  if (!privateKey) throw new Error('No device private key found.');
  const sharedKey = await deriveWrappingKey(privateKey, ephemeralPublicKeyJwk);
  const { iv, ct } = JSON.parse(encryptedB64);
  const plain = await aesDecrypt(sharedKey, fromBase64(iv), fromBase64(ct));
  return new TextDecoder().decode(plain);
}

export async function decryptRecoveredTotemKey(
  encryptedB64: string,
  ephemeralPublicKeyJwk: JsonWebKey
): Promise<CryptoKey> {
  const privateKey = await loadPrivateKey();
  if (!privateKey) throw new Error('No device private key found.');
  const sharedKey = await deriveWrappingKey(privateKey, ephemeralPublicKeyJwk);
  const { iv, ct } = JSON.parse(encryptedB64);
  const plain = await aesDecrypt(sharedKey, fromBase64(iv), fromBase64(ct));
  return importTotemKey(plain);
}

// ── Load / save (API-backed) ──────────────────────────────────────────────────

export const BASE = (typeof import.meta !== 'undefined' && (import.meta as { env?: { VITE_OURACLE_BASE_URL?: string } }).env?.VITE_OURACLE_BASE_URL) ?? 'https://api.ouracle.kerry.ink';

const DEVICE_PUBLIC_KEY_STORAGE = 'ouracle_device_public_key';

export function storeDevicePublicKey(jwk: JsonWebKey): void {
  localStorage.setItem(DEVICE_PUBLIC_KEY_STORAGE, JSON.stringify(jwk));
}

export function loadDevicePublicKey(): JsonWebKey | null {
  const raw = localStorage.getItem(DEVICE_PUBLIC_KEY_STORAGE);
  return raw ? JSON.parse(raw) : null;
}

async function fetchDevices(token: string): Promise<Array<{ public_key: string; wrapped_key: string | null }>> {
  const devRes = await fetch(`${BASE}/totem/devices`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!devRes.ok) {
    console.warn('[totem] fetchDevices failed', devRes.status, `${BASE}/totem/devices`);
  }
  return devRes.ok ? await devRes.json() : [];
}

async function recoverTotemKeyForDevice(
  token: string,
  publicKeyStr: string,
  publicKeyJwk: JsonWebKey,
  privateKey: CryptoKey
): Promise<CryptoKey | null> {
  const recoveryRes = await fetch(`${BASE}/totem/recover-key`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ public_key: publicKeyStr }),
  });

  if (!recoveryRes.ok) {
    console.warn('[totem] recover-key failed', recoveryRes.status, `${BASE}/totem/recover-key`);
    return null;
  }
  const { encrypted_key, ephemeral_public_key } = await recoveryRes.json();
  const totemKey = await decryptRecoveredTotemKey(encrypted_key, ephemeral_public_key);
  const wrappedKey = await wrapTotemKey(totemKey, publicKeyJwk, privateKey);
  const registerRes = await fetch(`${BASE}/totem/devices`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ public_key: publicKeyStr, wrapped_key: wrappedKey }),
  });
  if (!registerRes.ok) {
    console.warn('[totem] device register after recovery failed', registerRes.status, `${BASE}/totem/devices`);
  }
  return totemKey;
}

/**
 * Full device key ceremony for first-time setup on this device.
 * Generates keypair, creates totem key, wraps it, registers device,
 * and saves an empty totem. Safe to call if device already registered —
 * will no-op if private key already exists in IndexedDB.
 */
export async function initDevice(token: string): Promise<{ totemKey: CryptoKey; totemData: TotemData | null }> {
  let privateKey = await loadPrivateKey();
  let publicKeyJwk = loadDevicePublicKey();

  if (!privateKey || !publicKeyJwk) {
    const pair = await generateDeviceKeyPair();
    await storePrivateKey(pair.privateKey);
    storeDevicePublicKey(pair.publicKeyJwk);
    privateKey = pair.privateKey;
    publicKeyJwk = pair.publicKeyJwk;
  }

  // Check if this device is already registered
  const devices = await fetchDevices(token);
  const publicKeyStr = JSON.stringify(publicKeyJwk);
  const existing = devices.find((d) => d.public_key === publicKeyStr);

  if (existing?.wrapped_key) {
    // Device registered and wrapped key exists — just load the totem
    const totemKey = await unwrapTotemKey(existing.wrapped_key, publicKeyJwk, privateKey);
    const totemData = await _fetchAndDecrypt(token, totemKey);
    return { totemKey, totemData };
  }

  // Existing account but new device: recover the shared totem key via auth-backed escrow.
  const recoveredTotemKey = await recoverTotemKeyForDevice(token, publicKeyStr, publicKeyJwk, privateKey);
  if (recoveredTotemKey) {
    const totemData = await _fetchAndDecrypt(token, recoveredTotemKey);
    return { totemKey: recoveredTotemKey, totemData };
  }

  const existingTotemRes = await fetch(`${BASE}/totem`, { headers: { Authorization: `Bearer ${token}` } });
  const existingTotem = existingTotemRes.ok ? await existingTotemRes.json() : null;
  if (existingTotem?.ciphertext) {
    throw new Error('Existing Totem could not be recovered on this device.');
  }

  // Brand new account: create a fresh totem key and register
  const totemKey = await generateTotemKey();
  const wrappedKey = await wrapTotemKey(totemKey, publicKeyJwk, privateKey);

  const registerRes = await fetch(`${BASE}/totem/devices`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ public_key: publicKeyStr, wrapped_key: wrappedKey }),
  });
  if (!registerRes.ok) {
    console.warn('[totem] initial device register failed', registerRes.status, `${BASE}/totem/devices`);
  }

  return { totemKey, totemData: null };
}

async function _loadExistingDeviceTotem(
  token: string,
  publicKeyJwk: JsonWebKey,
  privateKey: CryptoKey
): Promise<TotemData | null> {
  const devices = await fetchDevices(token);
  const publicKeyStr = JSON.stringify(publicKeyJwk);
  const device = devices.find((d) => d.public_key === publicKeyStr);
  if (device?.wrapped_key) {
    const totemKey = await unwrapTotemKey(device.wrapped_key, publicKeyJwk, privateKey);
    const totemData = await _fetchAndDecrypt(token, totemKey);
    return totemData;
  }
  const recoveredTotemKey = await recoverTotemKeyForDevice(token, publicKeyStr, publicKeyJwk, privateKey);
  if (!recoveredTotemKey) return null;
  return _fetchAndDecrypt(token, recoveredTotemKey);
}

async function _fetchAndDecrypt(token: string, totemKey: CryptoKey): Promise<TotemData | null> {
  const res = await fetch(`${BASE}/totem`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const { ciphertext } = await res.json();
  if (!ciphertext) return null;
  try {
    return await decryptTotem(ciphertext, totemKey);
  } catch {
    return null;
  }
}

export async function loadTotem(_seekerId: string, token: string): Promise<TotemData | null> {
  const privateKey = await loadPrivateKey();
  const publicKeyJwk = loadDevicePublicKey();
  if (!privateKey || !publicKeyJwk) return null;
  return _loadExistingDeviceTotem(token, publicKeyJwk, privateKey);
}

export async function saveTotem(data: TotemData, totemKey: CryptoKey, devicePublicKeyJwk: JsonWebKey, token: string): Promise<void> {
  const ciphertext = await encryptTotem(data, totemKey);
  const recovery_key = await exportTotemKeyBase64(totemKey);
  await fetch(`${BASE}/totem`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ciphertext, public_key: JSON.stringify(devicePublicKeyJwk), recovery_key }),
  });
}
