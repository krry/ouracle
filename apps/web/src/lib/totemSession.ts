import { loadTotem, saveTotem, initDevice, loadPrivateKey, loadDevicePublicKey, generateTotemKey, wrapTotemKey } from './totem';
import type { TotemData } from './totem';

type LoadFn = (seekerId: string) => Promise<TotemData | null>;
type SaveFn = (seekerId: string, totem: TotemData) => Promise<void>;
type FetchFn = (sessionId: string, token: string) => Promise<Response>;

export class TotemSession {
  private totem: TotemData | null = null;
  private totemKey: CryptoKey | null = null;

  constructor(
    private token: string,
    private seekerId: string,
    private _load: LoadFn = (id) => loadTotem(id, token),
    private _save: SaveFn = async (_id, totem) => {
      if (!this.totemKey) {
        const result = await initDevice(token);
        this.totemKey = result.totemKey;
      }
      const publicKeyJwk = loadDevicePublicKey();
      if (!publicKeyJwk) return;
      await saveTotem(totem, this.totemKey!, publicKeyJwk, token);
    },
  ) {}

  get isLoaded() { return this.totem !== null; }

  async load(): Promise<void> {
    this.totem = await this._load(this.seekerId);
  }

  /**
   * Called after session ends. Fetches distillation from API (encrypted to
   * this device's public key), decrypts it client-side, merges into totem,
   * and persists.
   *
   * fetchFn is injectable for testing — defaults to real fetch in production.
   */
  async distillAndSave(
    sessionId: string,
    fetchFn: FetchFn = (sid, tok) => fetch('/totem/distill', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sid }),
    }),
  ): Promise<void> {
    if (!this.totem) return;

    let res: Response;
    try {
      res = await fetchFn(sessionId, this.token);
    } catch {
      return; // network error — non-fatal
    }
    if (!res.ok) return;

    const { encrypted_distillation, ephemeral_public_key } = await res.json();
    // decryptDistillation returns Promise<string>
    const entry = await decryptDistillation(encrypted_distillation, ephemeral_public_key);

    // Merge distillation into sessions array
    this.totem.sessions = [
      ...(this.totem.sessions ?? []),
      { id: crypto.randomUUID(), at: new Date().toISOString(), note: entry },
    ];
    this.totem.updated_at = new Date().toISOString();

    await this._save(this.seekerId, this.totem);
  }
}
