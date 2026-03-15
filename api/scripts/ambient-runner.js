#!/usr/bin/env bun
// ambient-runner.js — spawned by the TUI to run ambient audio
// Runs until killed (SIGTERM).
import { AmbientPlayer } from '../ambient-player.js';

const player = new AmbientPlayer();
player.start();

process.on('SIGTERM', () => { player.stop(); process.exit(0); });
process.on('SIGINT',  () => { player.stop(); process.exit(0); });

// Keep alive
setInterval(() => {}, 60_000);
