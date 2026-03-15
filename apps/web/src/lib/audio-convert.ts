/**
 * Convert an audio Blob (any format the browser can decode) to 16kHz mono WAV.
 * Fish Audio ASR and most speech recognition services accept WAV without issues.
 */
export async function blobToWav(blob: Blob, ctx: AudioContext, sampleRate = 16000): Promise<Blob> {
	const arrayBuf = await blob.arrayBuffer();
	console.log('[blobToWav] blob size:', blob.size, 'type:', blob.type, '| ctx state:', ctx.state);
	await ctx.resume();
	console.log('[blobToWav] ctx state after resume:', ctx.state);
	const decoded = await ctx.decodeAudioData(arrayBuf);

	// Resample to target sampleRate via OfflineAudioContext
	const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * sampleRate), sampleRate);
	const src = offline.createBufferSource();
	src.buffer = decoded;
	src.connect(offline.destination);
	src.start(0);
	const rendered = await offline.startRendering();

	return encodeWav(rendered.getChannelData(0), sampleRate);
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
	const pcm = floatTo16BitPcm(samples);
	const header = wavHeader(pcm.byteLength, sampleRate);
	return new Blob([header, pcm], { type: 'audio/wav' });
}

function floatTo16BitPcm(input: Float32Array): Int16Array {
	const out = new Int16Array(input.length);
	for (let i = 0; i < input.length; i++) {
		const s = Math.max(-1, Math.min(1, input[i]));
		out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
	}
	return out;
}

function wavHeader(pcmByteLength: number, sampleRate: number): ArrayBuffer {
	const buf = new ArrayBuffer(44);
	const v = new DataView(buf);
	const channels = 1;
	const bitsPerSample = 16;
	const byteRate = (sampleRate * channels * bitsPerSample) / 8;
	const blockAlign = (channels * bitsPerSample) / 8;

	// RIFF chunk
	v.setUint32(0, 0x52494646, false);           // "RIFF"
	v.setUint32(4, 36 + pcmByteLength, true);    // file size - 8
	v.setUint32(8, 0x57415645, false);            // "WAVE"
	// fmt sub-chunk
	v.setUint32(12, 0x666d7420, false);           // "fmt "
	v.setUint32(16, 16, true);                    // subchunk size
	v.setUint16(20, 1, true);                     // PCM = 1
	v.setUint16(22, channels, true);
	v.setUint32(24, sampleRate, true);
	v.setUint32(28, byteRate, true);
	v.setUint16(32, blockAlign, true);
	v.setUint16(34, bitsPerSample, true);
	// data sub-chunk
	v.setUint32(36, 0x64617461, false);           // "data"
	v.setUint32(40, pcmByteLength, true);

	return buf;
}
