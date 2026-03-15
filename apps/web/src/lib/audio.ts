import { voiceState, waveform } from './stores';

type FetchFn = (text: string) => Promise<ArrayBuffer>;

export class AudioQueue {
  private queue: string[] = [];
  private _playing = false;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private rafId = 0;

  constructor(private fetchAudio: FetchFn) {}

  /** Call from a user-gesture handler (e.g. send button, PTT) to unlock the AudioContext. */
  prime() {
    this.ctx ??= new AudioContext();
    this.ctx.resume().catch(() => {});
  }

  get length() { return this.queue.length; }
  get playing() { return this._playing; }

  enqueue(text: string) {
    this.queue.push(text);
    if (!this._playing) queueMicrotask(() => this._drain());
  }

  flush() {
    this.queue = [];
  }

  private async _drain() {
    if (this._playing || this.queue.length === 0) return;
    this._playing = true;
    voiceState.set('speaking');

    while (this.queue.length > 0) {
      const text = this.queue.shift()!;
      try {
        const buf = await this.fetchAudio(text);
        await this._play(buf);
      } catch {
        // skip failed chunk
      }
    }

    this._playing = false;
    cancelAnimationFrame(this.rafId);
    waveform.set(new Float32Array(64));
    voiceState.set('idle');
  }

  private _play(arrayBuffer: ArrayBuffer): Promise<void> {
    return new Promise((resolve) => {
      this.ctx ??= new AudioContext();
      const ctx = this.ctx;
      ctx.resume().catch(() => {});

      if (!this.analyser) {
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 128;
        this.analyser.connect(ctx.destination);
      }

      ctx.decodeAudioData(arrayBuffer.slice(0), (decoded) => {
        const src = ctx.createBufferSource();
        src.buffer = decoded;
        src.connect(this.analyser!);
        src.onended = () => resolve();
        src.start();

        const buf = new Float32Array(this.analyser!.frequencyBinCount);
        const tick = () => {
          if (!this._playing) return;
          this.analyser!.getFloatTimeDomainData(buf);
          waveform.set(buf.slice());
          this.rafId = requestAnimationFrame(tick);
        };
        tick();
      }, () => resolve());
    });
  }
}

// Instantiate per component mount — do NOT use a module-level singleton.
// Stale state across navigation is avoided by having Chat.svelte own the lifetime.
export function createAudioQueue(fetchFn: FetchFn): AudioQueue {
  return new AudioQueue(fetchFn);
}
