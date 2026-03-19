import { voiceState, waveform } from './stores';

type FetchFn = (text: string) => Promise<ArrayBuffer>;

type QueueItem = { type: 'text'; text: string } | { type: 'buffer'; buffer: ArrayBuffer };

// AudioQueue supports both text (to fetch) and pre-decoded buffers (for streaming TTS)
export class AudioQueue {
  private queue: QueueItem[] = [];
  private _playing = false;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private rafId = 0;

  constructor(private fetchAudio: FetchFn) {}

  prime() {
    this.ctx ??= new AudioContext();
    this.ctx.resume().catch(() => {});
  }

  get length() { return this.queue.length; }
  get playing() { return this._playing; }

  enqueue(text: string) {
    this.queue.push({ type: 'text', text });
    if (!this._playing) queueMicrotask(() => this._drain());
  }

  // Enqueue a pre-decoded audio buffer (base64 from server)
  enqueueBuffer(buffer: ArrayBuffer) {
    this.queue.push({ type: 'buffer', buffer });
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
      const item = this.queue.shift()!;
      let buf: ArrayBuffer;
      if (item.type === 'text') {
        try {
          buf = await this.fetchAudio(item.text);
        } catch {
          // skip failed fetch
          continue;
        }
      } else {
        buf = item.buffer;
      }
      await this._play(buf);
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

export function createAudioQueue(fetchFn: FetchFn): AudioQueue {
  return new AudioQueue(fetchFn);
}
