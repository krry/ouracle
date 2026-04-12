import { vi } from 'vitest';

// Mock AudioContext and related APIs for jsdom
class MockAudioContext {
  state = 'suspended';
  currentTime = 0;
  resume = vi.fn().mockResolvedValue(undefined);
  suspend = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
  
  createGain = vi.fn(() => ({
    gain: { value: 1, setTargetAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
  
  createAnalyser = vi.fn(() => ({
    fftSize: 128,
    frequencyBinCount: 64,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getFloatTimeDomainData: vi.fn(),
  }));
  
  createBufferSource = vi.fn(() => {
    const source = {
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(() => {
        // Automatically trigger onended to allow promises to resolve
        setTimeout(() => {
          if (typeof source.onended === 'function') {
            source.onended(new Event('ended'));
          }
        }, 0);
      }),
      stop: vi.fn(),
      onended: null as ((ev: Event) => void) | null,
    };
    return source;
  });
  
  decodeAudioData = vi.fn((data, success) => {
    const decoded = { duration: 1 };
    if (success) success(decoded);
    return Promise.resolve(decoded);
  });

  createStereoPanner = vi.fn(() => ({
    pan: { value: 0 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));

  createMediaStreamSource = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
  
  destination = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

class MockOfflineAudioContext extends MockAudioContext {
  startRendering = vi.fn().mockResolvedValue({
    getChannelData: vi.fn(() => new Float32Array(100)),
  });
}

vi.stubGlobal('AudioContext', MockAudioContext);
vi.stubGlobal('OfflineAudioContext', MockOfflineAudioContext);

// Also mock navigator.mediaDevices
if (typeof navigator !== 'undefined') {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      }),
    },
    configurable: true,
  });
}
