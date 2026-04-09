import { loadTotem, saveTotem, initDevice, loadDevicePublicKey, decryptDistillation } from './totem';
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
    if (!this.totem) {
      try {
        const result = await initDevice(this.token);
        this.totemKey = result.totemKey;
        this.totem = result.totemData;
      } catch {
        // non-fatal — records remain unavailable on this device for now
      }
    }
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
    const payload = await decryptDistillation(encrypted_distillation, ephemeral_public_key);

    let distillation: {
      arc?: string;
      qualities?: { dominant?: string; current?: string };
      beliefs?: string[];
      rite?: { name?: string; act?: string };
      session_note?: string;
      report?: string;
      context?: string;
    } = {};

    try {
      distillation = JSON.parse(payload);
    } catch {
      distillation = { session_note: payload };
    }

    const record = {
      id: sessionId,
      session_id: sessionId,
      at: new Date().toISOString(),
      quality: distillation.qualities?.dominant,
      note: distillation.session_note,
      feedback: distillation.report,
      context: distillation.context,
      rite_name: distillation.rite?.name,
      beliefs: distillation.beliefs ?? [],
      current_state: distillation.qualities?.current,
      dominant_quality: distillation.qualities?.dominant,
    };

    const existing = this.totem.sessions ?? [];
    const withoutCurrent = existing.filter((entry) => entry.session_id !== sessionId && entry.id !== sessionId);
    this.totem.sessions = [record, ...withoutCurrent];
    this.totem.arc = distillation.arc ?? this.totem.arc;
    this.totem.qualities = {
      dominant: distillation.qualities?.dominant ?? this.totem.qualities?.dominant ?? '',
      current: distillation.qualities?.current ?? this.totem.qualities?.current ?? '',
    };
    this.totem.beliefs = distillation.beliefs ?? this.totem.beliefs ?? [];
    this.totem.context = distillation.context ?? this.totem.context;
    if (distillation.rite?.name && distillation.rite?.act) {
      this.totem.rites = [
        { name: distillation.rite.name, act: distillation.rite.act, at: new Date().toISOString() },
        ...(this.totem.rites ?? []).filter((rite) => rite.name !== distillation.rite?.name)
      ];
    }
    this.totem.updated_at = new Date().toISOString();

    await this._save(this.seekerId, this.totem);
  }
}
