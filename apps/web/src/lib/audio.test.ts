import { describe, it, expect } from 'vitest';
import { AudioQueue, createAudioQueue } from './audio';

describe('AudioQueue', () => {
  it('starts empty and idle', () => {
    const q = new AudioQueue(() => Promise.resolve(new ArrayBuffer(0)));
    expect(q.length).toBe(0);
    expect(q.playing).toBe(false);
  });

  it('enqueue increases length', () => {
    const q = new AudioQueue(() => Promise.resolve(new ArrayBuffer(0)));
    q.enqueue('hello');
    expect(q.length).toBe(1);
  });

  it('flush clears queue', () => {
    const q = new AudioQueue(() => Promise.resolve(new ArrayBuffer(0)));
    q.enqueue('hello');
    q.flush();
    expect(q.length).toBe(0);
  });

  it('createAudioQueue factory returns AudioQueue', () => {
    const q = createAudioQueue(() => Promise.resolve(new ArrayBuffer(0)));
    expect(q).toBeInstanceOf(AudioQueue);
  });
});
