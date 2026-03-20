import { voiceState, waveform } from './stores';

type FetchFn = (text: string) => Promise<ArrayBuffer>;

export interface AudioSegment {
  id: string;
  text: string;
  audioBlob: Blob;
  duration: number;
  skipped: boolean;
  timestamp: number;
  sequence?: number;
}

export type AudioManagerEvent =
  | { type: 'playing'; segment: AudioSegment }
  | { type: 'skipped'; segment: AudioSegment }
  | { type: 'paused' }
  | { type: 'resumed' }
  | { type: 'mute' }
  | { type: 'unmute' }
  | { type: 'queue-update'; length: number }
  | { type: 'ended' };

const DB_NAME = 'AudioManagerDB';
const STORE_NAME = 'skipped_audio';
const DB_VERSION = 1;

async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('skipped', 'skipped', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = () => reject(request.error);
  });
}

async function saveSegment(db: IDBDatabase, segment: AudioSegment): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(segment);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getSkippedSegments(db: IDBDatabase): Promise<AudioSegment[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result.filter(s => s.skipped));
    request.onerror = () => reject(request.error);
  });
}

async function clearHistory(db: IDBDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

interface QueueItem {
  text: string;
  resolve: (blob: Blob) => void;
  buffer?: ArrayBuffer;
  sequence?: number;
}

export class AudioManager {
  private queue: QueueItem[] = [];
  private currentSource: AudioBufferSourceNode | null = null;
  private currentSegment: AudioSegment | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private rafId = 0;
  private db: IDBDatabase | null = null;
  private _muted = false;
  private _playing = false;
  private _paused = false;
  private eventHandlers: Set<(event: AudioManagerEvent) => void> = new Set();
  private idCounter = 0;
  private gainNode: GainNode | null = null;
  private currentPlayResolve: (() => void) | null = null;

  constructor(private fetchAudio: FetchFn) {
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      initDB().then(db => this.db = db).catch(() => console.warn('IndexedDB unavailable'));
    }
  }

  get playing() { return this._playing; }
  get paused() { return this._paused; }
  get muted() { return this._muted; }
  get queueLength() { return this.queue.length; }

  onEvent(handler: (event: AudioManagerEvent) => void): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  private emit(event: AudioManagerEvent) {
    this.eventHandlers.forEach(handler => handler(event));
  }

  prime() {
    this.ctx ??= new AudioContext();
    this.ctx.resume().catch(() => {});
  }

  enqueue(text: string): Promise<Blob> {
    return new Promise((resolve) => {
      this.queue.push({ text, resolve });
      if (!this._playing && !this._paused) queueMicrotask(() => this._drain());
    });
  }

  enqueueBuffer(buffer: ArrayBuffer, text: string = '', sequence?: number): Promise<Blob> {
    return new Promise((resolve) => {
      this.queue.push({ text, resolve, buffer, sequence });
      if (!this._playing && !this._paused) queueMicrotask(() => this._drain());
    });
  }

  enqueueBase64(seq: number, base64: string, text: string): Promise<Blob> {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const buffer = bytes.buffer;
    return this.enqueueBuffer(buffer, text, seq);
  }

  flush() {
    if (this.currentSource) {
      this.currentSource.stop();
      this.currentSource = null;
    }
    this.queue = [];
    this._playing = false;
    this._paused = false;
    cancelAnimationFrame(this.rafId);
    voiceState.set('idle');
    waveform.set(new Float32Array(64));
  }

  skip(): boolean {
    if (this.currentSource && this._playing) {
      this.currentSource.stop();
      this._finishCurrentSegment(true);
      return true;
    }
    return false;
  }

  pause() {
    if (this._playing && this.currentSource) {
      this.currentSource.stop();
      this._paused = true;
      this._playing = false;
      this.emit({ type: 'paused' });
    }
  }

  resume() {
    if (this._paused && this.currentSegment) {
      this._playSegment(this.currentSegment);
    }
  }

  mute() {
    if (!this._muted) {
      this._muted = true;
      if (this.gainNode) {
        this.gainNode.gain.value = 0;
      }
      this.emit({ type: 'mute' });
    }
  }

  unmute() {
    if (this._muted) {
      this._muted = false;
      if (this.gainNode) {
        this.gainNode.gain.value = 1;
      }
      this.emit({ type: 'unmute' });
    }
  }

  setMuted(muted: boolean) {
    if (muted) this.mute();
    else this.unmute();
  }

  async getReplayHistory(): Promise<AudioSegment[]> {
    if (!this.db) return [];
    try {
      return await getSkippedSegments(this.db);
    } catch {
      return [];
    }
  }

  async replaySegment(segment: AudioSegment): Promise<void> {
    if (this._playing) this.skip();
    await this._playSegment(segment);
  }

  clearHistory() {
    if (this.db) clearHistory(this.db).catch(() => {});
  }

  private async _drain() {
    if (this._playing || this._paused || this.queue.length === 0) return;

    this._playing = true;
    this._paused = false;
    voiceState.set('speaking');

    while (this.queue.length > 0 && this._playing) {
      const item = this.queue.shift()!;
      let buf: ArrayBuffer;
      if (item.buffer !== undefined) {
        buf = item.buffer;
      } else {
        try {
          buf = await this.fetchAudio(item.text);
        } catch (e) {
          item.resolve(new Blob([]));
          continue;
        }
      }
      const blob = new Blob([buf], { type: 'audio/wav' });
      const audio = await this._play(buf, item.text, false, item.sequence);
      item.resolve(blob);
      if (!this._playing) break;
    }

    if (!this._paused) {
      this._playing = false;
      cancelAnimationFrame(this.rafId);
      waveform.set(new Float32Array(64));
      voiceState.set('idle');
      this.emit({ type: 'ended' });
    }
  }

  private _play(arrayBuffer: ArrayBuffer, text: string, isReplay: boolean, sequence?: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.ctx ??= new AudioContext();
      const ctx = this.ctx;
      this.currentPlayResolve = resolve;

      ctx.decodeAudioData(arrayBuffer.slice(0), async (decoded) => {
        const segment: AudioSegment = {
          id: `seg_${++this.idCounter}`,
          text,
          audioBlob: new Blob([arrayBuffer], { type: 'audio/wav' }),
          duration: decoded.duration,
          skipped: false,
          timestamp: Date.now(),
        };
        if (sequence !== undefined) segment.sequence = sequence;

        this.currentSegment = segment;
        const source = ctx.createBufferSource();
        source.buffer = decoded;
        this.currentSource = source;

        if (!this.analyser) {
          this.analyser = ctx.createAnalyser();
          this.analyser.fftSize = 128;
        }
        if (!this.gainNode) {
          this.gainNode = ctx.createGain();
          this.gainNode.connect(ctx.destination);
        }

        source.connect(this.analyser);
        this.analyser.connect(this.gainNode);
        this.gainNode.gain.value = this._muted ? 0 : 1;

        source.onended = async () => {
          if (!this._paused) {
            this._finishCurrentSegment(false);
          }
        };

        source.start();

        this.emit({ type: 'playing', segment });

        const buf = new Float32Array(this.analyser!.frequencyBinCount);
        const tick = () => {
          if (this._playing) {
            this.analyser!.getFloatTimeDomainData(buf);
            waveform.set(buf.slice());
            this.rafId = requestAnimationFrame(tick);
          }
        };
        tick();
      }, () => {
        this.currentPlayResolve?.();
      });
    });
  }

  private _finishCurrentSegment(skipped: boolean): void {
    if (this.currentSource) {
      this.currentSource.disconnect();
      this.currentSource = null;
    }
    if (this.currentSegment) {
      if (skipped) {
        this.currentSegment.skipped = true;
        if (this.db) {
          saveSegment(this.db, this.currentSegment).catch(() => {});
        }
        this.emit({ type: 'skipped', segment: this.currentSegment });
      } else {
        if (this.db) {
          saveSegment(this.db, this.currentSegment).catch(() => {});
        }
        this.emit({ type: 'queue-update', length: this.queue.length });
      }
      this.currentSegment = null;
    }
    const resolve = this.currentPlayResolve;
    this.currentPlayResolve = null;
    resolve?.();
  }

  private async _playSegment(segment: AudioSegment): Promise<void> {
    return this._play(await segment.audioBlob.arrayBuffer(), segment.text, true);
  }
}

export function createAudioManager(fetchFn: FetchFn): AudioManager {
  return new AudioManager(fetchFn);
}
