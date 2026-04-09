import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadMergedRecords, reportText } from './records';
import { getThread } from './api';
import { initDevice, loadTotem } from './totem';

vi.mock('./api', () => ({
  getThread: vi.fn(),
}));

vi.mock('./totem', () => ({
  loadTotem: vi.fn(),
  initDevice: vi.fn(),
}));

describe('records', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('merges encrypted totem entries onto complete thread records and filters incomplete sessions', async () => {
    vi.mocked(getThread).mockResolvedValue([
      {
        id: 'session-1',
        stage: 'complete',
        quality: 'presence',
        enacted: true,
        rite_name: 'Server Rite',
        rite_json: null,
        report: { notes: 'server report' },
        created_at: '2026-04-08T00:00:00.000Z',
        prescribed_at: null,
        completed_at: '2026-04-08T00:10:00.000Z',
      },
      {
        id: 'session-2',
        stage: 'prescribed',
        quality: null,
        enacted: null,
        rite_name: null,
        rite_json: null,
        report: null,
        created_at: '2026-04-08T00:20:00.000Z',
        prescribed_at: null,
        completed_at: null,
      },
    ]);

    vi.mocked(loadTotem).mockResolvedValue({
      v: 1,
      seeker_id: 'seeker-1',
      updated_at: '2026-04-08T00:11:00.000Z',
      name: '',
      arc: '',
      qualities: { dominant: '', current: '' },
      beliefs: [],
      rites: [],
      sessions: [
        {
          id: 'entry-1',
          session_id: 'session-1',
          at: '2026-04-08T00:10:30.000Z',
          note: 'encrypted note',
          context: 'encrypted context',
          beliefs: ['a belief'],
          rite_name: 'Encrypted Rite',
          dominant_quality: 'courage',
        },
      ],
      context: '',
    });

    const records = await loadMergedRecords('seeker-1', 'token');

    expect(records).toHaveLength(1);
    expect(records[0].id).toBe('session-1');
    expect(records[0].encrypted_note).toBe('encrypted note');
    expect(records[0].encrypted_context).toBe('encrypted context');
    expect(records[0].encrypted_beliefs).toEqual(['a belief']);
    expect(records[0].encrypted_rite_name).toBe('Encrypted Rite');
    expect(records[0].encrypted_quality).toBe('courage');
  });

  it('attempts device init when no totem is initially available', async () => {
    vi.mocked(getThread).mockResolvedValue([
      {
        id: 'session-1',
        stage: 'complete',
        quality: null,
        enacted: null,
        rite_name: null,
        rite_json: null,
        report: null,
        created_at: '2026-04-08T00:00:00.000Z',
        prescribed_at: null,
        completed_at: '2026-04-08T00:10:00.000Z',
      },
    ]);
    vi.mocked(loadTotem).mockResolvedValue(null);
    vi.mocked(initDevice).mockResolvedValue({
      totemKey: {} as CryptoKey,
      totemData: null,
    });

    await loadMergedRecords('seeker-1', 'token');

    expect(initDevice).toHaveBeenCalledWith('token');
  });

  it('extracts report text from legacy shapes', () => {
    expect(reportText('plain string')).toBe('plain string');
    expect(reportText({ notes: 'notes text' })).toBe('notes text');
    expect(reportText({ unexpected: 'surprise' })).toBe('surprise');
    expect(reportText(null)).toBeNull();
  });
});
