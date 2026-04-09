import { beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('./totem', () => ({
  loadTotem: vi.fn(),
  saveTotem: vi.fn(),
  initDevice: vi.fn().mockResolvedValue({ totemKey: {} as CryptoKey, totemData: null }),
  loadDevicePublicKey: vi.fn().mockReturnValue({ kty: 'EC' }),
  decryptDistillation: vi.fn(),
}));

import { TotemSession } from './totemSession';
import { decryptDistillation } from './totem';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('TotemSession', () => {
  it('isLoaded starts false', () => {
    const s = new TotemSession('token', 'seeker-1', vi.fn(), vi.fn());
    expect(s.isLoaded).toBe(false);
  });

  it('load() calls loadTotem', async () => {
    const loadMock = vi.fn().mockResolvedValue({ v: 2, seeker_id: 'seeker-1', sessions: [] });
    const saveMock = vi.fn().mockResolvedValue(undefined);
    const s = new TotemSession('token', 'seeker-1', loadMock, saveMock);
    await s.load();
    expect(loadMock).toHaveBeenCalledWith('seeker-1');
    expect(s.isLoaded).toBe(true);
  });

  it('distillAndSave is a no-op when not loaded', async () => {
    const fetchMock = vi.fn();
    const s = new TotemSession('token', 'seeker-1', vi.fn(), vi.fn());
    // Should not throw, just return
    await s.distillAndSave('session-123', fetchMock);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('distillAndSave merges parsed distillation into the encrypted record set', async () => {
    vi.mocked(decryptDistillation).mockResolvedValue(
      JSON.stringify({
        arc: 'crossing a threshold',
        qualities: { dominant: 'presence', current: 'ventral' },
        beliefs: ['i must do this alone'],
        rite: { name: 'Bell rite', act: 'ring the bell' },
        session_note: 'A clear shift happened.',
        context: 'Remember the bell at the threshold.',
      })
    );

    const loadMock = vi.fn().mockResolvedValue({
      v: 2,
      seeker_id: 'seeker-1',
      updated_at: '2026-04-08T00:00:00.000Z',
      name: '',
      arc: '',
      qualities: { dominant: '', current: '' },
      beliefs: [],
      rites: [],
      sessions: [],
      context: '',
    });
    const saveMock = vi.fn().mockResolvedValue(undefined);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        encrypted_distillation: '{"iv":"aQ==","ct":"aQ=="}',
        ephemeral_public_key: { kty: 'EC' },
      }),
    });

    const s = new TotemSession('token', 'seeker-1', loadMock, saveMock);
    await s.load();
    await s.distillAndSave('session-123', fetchMock);

    expect(fetchMock).toHaveBeenCalledWith('session-123', 'token');
    expect(saveMock).toHaveBeenCalledTimes(1);

    const savedTotem = saveMock.mock.calls[0][1];
    expect(savedTotem.arc).toBe('crossing a threshold');
    expect(savedTotem.qualities).toEqual({ dominant: 'presence', current: 'ventral' });
    expect(savedTotem.beliefs).toEqual(['i must do this alone']);
    expect(savedTotem.context).toBe('Remember the bell at the threshold.');
    expect(savedTotem.rites[0]).toMatchObject({ name: 'Bell rite', act: 'ring the bell' });
    expect(savedTotem.sessions[0]).toMatchObject({
      id: 'session-123',
      session_id: 'session-123',
      note: 'A clear shift happened.',
      context: 'Remember the bell at the threshold.',
      rite_name: 'Bell rite',
      beliefs: ['i must do this alone'],
      current_state: 'ventral',
      dominant_quality: 'presence',
    });
  });
});
