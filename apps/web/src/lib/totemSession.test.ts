import { describe, it, expect, vi } from 'vitest';
import { TotemSession } from './totemSession';

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
});
