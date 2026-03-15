#!/usr/bin/env bun
/**
 * test-clea.js — Clea voice test harness
 *
 * Modes:
 *   bun scripts/test-clea.js --openings     Print all opening + closing pairs
 *   bun scripts/test-clea.js --listen       Speak all openings + closings via Fish.audio
 *   bun scripts/test-clea.js --chat         Free-form conversation with Clea via LLM
 *
 * Environment:
 *   LLM_PROVIDER                'ollama' (default) | 'groq'
 *   OLLAMA_MODEL                default: llama3:8b
 *   GROQ_API_KEY                required for groq
 *   GROQ_MODEL                  default: llama-3.1-8b-instant
 *   FISH_AUDIO_API_KEY          required for --listen
 *   FISH_AUDIO_VOICE_GALADRIEL  voice reference_id
 */

import * as readline from 'readline';
import { OPENING_QUESTIONS, CLOSING_DEDICATIONS } from '../engine.js';
import { makeLlmClient } from '../llm-client.js';
import { speak, fetchAudio, playBuffer, hasFishKey } from '../fish-tts.js';
import { AmbientPlayer } from '../ambient-player.js';

// ── Clea system prompt ────────────────────────────────────────────────────────

import { CLEA_SYSTEM_PROMPT } from '../clea-prompt.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function stripAudioTags(text) {
  return text.replace(/\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim();
}

function printPair(i, question, dedication) {
  const qDisplay = stripAudioTags(question);
  const dDisplay = stripAudioTags(dedication);
  const tags = [...dedication.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
  console.log(`\n${String(i + 1).padStart(2)}. \x1b[36m${qDisplay}\x1b[0m`);
  console.log(`    \x1b[90m↳\x1b[0m \x1b[35m${dDisplay}\x1b[0m`);
  if (tags.length) console.log(`    \x1b[90m[${tags.join('] [')}]\x1b[0m`);
}

// ── Mode: --openings ──────────────────────────────────────────────────────────

function runOpenings() {
  console.log('\n\x1b[1mClea — Openings & Closings\x1b[0m');
  console.log('\x1b[90m─────────────────────────────────────────────────\x1b[0m');
  OPENING_QUESTIONS.forEach((q, i) => printPair(i, q, CLOSING_DEDICATIONS[i] ?? '—'));
  console.log('\n\x1b[90m─────────────────────────────────────────────────\x1b[0m\n');
}

// ── Mode: --listen ────────────────────────────────────────────────────────────

async function runListen() {
  if (!hasFishKey()) {
    console.error('\x1b[31mFISH_AUDIO_API_KEY is not set.\x1b[0m');
    process.exit(1);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (prompt) => new Promise((r) => rl.question(prompt, r));

  console.log('\n\x1b[1mClea — listening\x1b[0m  \x1b[90mEnter to advance · q to quit\x1b[0m\n');

  for (let i = 0; i < OPENING_QUESTIONS.length; i++) {
    const question = OPENING_QUESTIONS[i];
    const dedication = CLOSING_DEDICATIONS[i] ?? '';

    printPair(i, question, dedication);

    const input = await ask('\x1b[90m[speak? enter / q]\x1b[0m ');
    if (input.trim().toLowerCase() === 'q') break;

    process.stdout.write('\x1b[90m  ♪ opening…\x1b[0m\r');
    await speak(question).catch((e) => console.error(`\x1b[31m  TTS error: ${e.message}\x1b[0m`));

    await new Promise((r) => setTimeout(r, 1200));

    process.stdout.write('\x1b[90m  ♪ closing…\x1b[0m\r');
    await speak(dedication).catch((e) => console.error(`\x1b[31m  TTS error: ${e.message}\x1b[0m`));

    process.stdout.write('                \r');
    console.log();
  }

  await new Promise((r) => setTimeout(r, 1200));
  process.stdout.write('\x1b[90m  ♪ seal…\x1b[0m\r');
  await speak('[low warmth, certain and at peace, a quiet smile] Always as it will have been.').catch((e) =>
    console.error(`\x1b[31m  TTS error: ${e.message}\x1b[0m`)
  );
  process.stdout.write('                \r\n');

  rl.close();
  console.log('\x1b[90mDone.\x1b[0m\n');
}

// ── Mode: --chat ──────────────────────────────────────────────────────────────

async function runChat() {
  let client;
  try {
    client = makeLlmClient();
  } catch (e) {
    console.error(`\x1b[31m${e.message}\x1b[0m`);
    process.exit(1);
  }

  const ambient = new AmbientPlayer();
  ambient.start();

  const history = [];
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (prompt) => new Promise((r) => rl.question(prompt, r));

  console.log(`\n\x1b[1mClea — free-form\x1b[0m  \x1b[90m(${client.provider} · ${client.model})\x1b[0m`);
  console.log('\x1b[90mEmpty line to quit.\x1b[0m\n');

  while (true) {
    const input = await ask('\x1b[32mYou › \x1b[0m');
    if (!input.trim()) break;

    history.push({ role: 'user', content: input });

    process.stdout.write('\n\x1b[35mClea › \x1b[0m');

    let full = '';
    let textBuf = '';  // tag-free text buffer for splitting
    let leadingTag = '';
    let tagExtracted = false;
    let playChain = Promise.resolve();

    let firstChunk = true;
    function enqueueChunk(text) {
      const clean = text.trim();
      if (!clean || !hasFishKey()) return;
      const ttsText = leadingTag ? `${leadingTag} ${clean}` : clean;

      if (firstChunk) {
        firstChunk = false;
        playChain = playChain.then(() => speak(ttsText).catch(() => {}));
      } else {
        const bufPromise = fetchAudio(ttsText).catch(() => null);
        playChain = playChain.then(async () => {
          const buf = await bufPromise;
          if (buf) await playBuffer(buf).catch(() => {});
        });
      }
    }

    try {
      const stream = await client.chat({
        system: CLEA_SYSTEM_PROMPT,
        messages: history,
        stream: true,
      });
      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content ?? '';
        full += token;
        process.stdout.write(token);

        // Accumulate raw into a scratch buffer to extract the leading tag once
        let scratch = (tagExtracted ? '' : (textBuf.endsWith(']') ? '' : textBuf.slice(textBuf.lastIndexOf('[') < 0 ? 0 : textBuf.lastIndexOf('['))) ) + token;

        if (!tagExtracted) {
          // Build up until we have a complete leading [tag]
          textBuf += token;
          const m = textBuf.match(/^(\[[^\]]+\])\s*([\s\S]*)$/);
          if (m) {
            leadingTag = m[1];
            textBuf = m[2]; // strip tag from buffer
            tagExtracted = true;
          }
          // If text has started without a tag, give up waiting
          else if (textBuf.length > 80 || (textBuf.trim() && !textBuf.includes('['))) {
            leadingTag = '';
            tagExtracted = true;
          }
        } else {
          // Tag extracted — buffer is tag-free, split on clause/sentence boundaries
          textBuf += stripAudioTags(token);
          let match;
          while ((match = textBuf.match(/^(.*?[.!?])\s+([\s\S]*)$/))) {
            enqueueChunk(match[1]);
            textBuf = match[2];
          }
          // Split at clause boundary only if the phrase has at least 5 words
          const clauseMatch = textBuf.match(/^(.*?[,;:\u2014])\s+([\s\S]*)$/);
          if (clauseMatch && clauseMatch[1].trim().split(/\s+/).filter(Boolean).length >= 5) {
            enqueueChunk(clauseMatch[1]);
            textBuf = clauseMatch[2];
          }
        }
      }
    } catch (e) {
      process.stdout.write(`\x1b[31m[error: ${e.message}]\x1b[0m`);
    }

    // Flush remainder
    if (textBuf.trim()) enqueueChunk(textBuf.trim());

    process.stdout.write('\n');

    const stripped = stripAudioTags(full);
    if (stripped !== full.trim()) {
      console.log(`\n\x1b[90m[display] ${stripped}\x1b[0m`);
    }

    // Wait for all sentences to finish playing
    if (hasFishKey()) {
      await playChain.catch(() => {});
    }

    console.log();
    if (full) history.push({ role: 'assistant', content: full });
  }

  ambient.stop();
  rl.close();
  console.log('\n\x1b[90mClosed.\x1b[0m\n');
}

// ── Entry ─────────────────────────────────────────────────────────────────────

const args = new Set(process.argv.slice(2));

if (args.has('--chat')) {
  await runChat();
} else if (args.has('--listen')) {
  await runListen();
} else if (args.has('--openings')) {
  runOpenings();
} else {
  runOpenings();
  console.log('Run with \x1b[1m--listen\x1b[0m to hear them · \x1b[1m--chat\x1b[0m to talk.\n');
}
