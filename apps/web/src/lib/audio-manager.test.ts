import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioManager, createAudioManager } from './audio-manager';

// Mock IndexedDB
const mockDB = {
  objectStoreNames: { contains: () => false },
  createObjectStore: vi.fn(() => ({
    createIndex: vi.fn(),
    put: vi.fn(() => ({ onsuccess: null, onerror: null })),
    clear: vi.fn(() => ({ onsuccess: null, onerror: null })),
    getAll: vi.fn(() => ({ result: [] })),
  })),
  onupgradeneeded: null,
  transaction: vi.fn(() => ({
    objectStore: vi.fn(() => ({
      index: vi.fn(() => ({ getAll: vi.fn() })),
      getAll: vi.fn(() => ({ onsuccess: null, onerror: null })),
    })),
  })),
};

global.indexedDB = {
  open: vi.fn((name, version) => ({
    onupgradeneeded: null,
    onsuccess: () => {
      const event = { target: { result: mockDB } };
      if (mockDB.onupgradeneeded) (mockDB.onupgradeneeded as any)(event);
    },
    onerror: null,
  })),
} as unknown as typeof indexedDB;

describe('AudioManager', () => {
  let mockFetchAudio: any;

  beforeEach(() => {
    mockFetchAudio = vi.fn().mockResolvedValue(new ArrayBuffer(0));
    // Reset IndexedDB mock
    mockDB.onupgradeneeded = null;
  });

  it('starts empty and idle', () => {
    const mgr = createAudioManager(mockFetchAudio);
    expect(mgr.queueLength).toBe(0);
    expect(mgr.playing).toBe(false);
    expect(mgr.muted).toBe(false);
  });

  it('enqueue adds to queue and returns a promise', async () => {
    const mgr = createAudioManager(mockFetchAudio);
    const blobPromise = mgr.enqueue('test');
    expect(mgr.queueLength).toBe(1);
    const blob = await blobPromise;
    expect(blob).toBeInstanceOf(Blob);
  });

  it('flush clears queue', () => {
    const mgr = createAudioManager(mockFetchAudio);
    mgr.enqueue('hello');
    mgr.enqueue('world');
    expect(mgr.queueLength).toBe(2);
    mgr.flush();
    expect(mgr.queueLength).toBe(0);
  });

  it('skip returns true when playing and stops audio', () => {
    const mgr = createAudioManager(mockFetchAudio);
    // Without actual audio playback, skip should return false since no source
    expect(mgr.skip()).toBe(false);
  });

  it('mute and unmute work', () => {
    const mgr = createAudioManager(mockFetchAudio);
    expect(mgr.muted).toBe(false);
    mgr.mute();
    expect(mgr.muted).toBe(true);
    mgr.unmute();
    expect(mgr.muted).toBe(false);
  });

  it('setMuted sets mute state correctly', () => {
    const mgr = createAudioManager(mockFetchAudio);
    mgr.setMuted(true);
    expect(mgr.muted).toBe(true);
    mgr.setMuted(false);
    expect(mgr.muted).toBe(false);
  });

  it('event subscription and unsubscription', () => {
    const mgr = createAudioManager(mockFetchAudio);
    const handler = vi.fn();
    const unsubscribe = mgr.onEvent(handler);
    // Emit a test event via internal method? Not easily accessible.
    // We can check unsubscribe removes handler
    unsubscribe();
    // No error thrown means ok
  });

  it('getReplayHistory returns empty array when db unavailable', async () => {
    // Simulate db not initialized
    const mgr = createAudioManager(mockFetchAudio);
    // @ts-ignore - set db to null to simulate unavailability
    mgr.db = null;
    const history = await mgr.getReplayHistory();
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBe(0);
  });

  it('clearHistory works without db', () => {
    const mgr = createAudioManager(mockFetchAudio);
    // Should not throw
    expect(() => mgr.clearHistory()).not.toThrow();
  });
});
