/**
 * ambient-player.js — layered ambient audio for Ouracle
 *
 * Two layers:
 *   1. Persistent: singing-bowls loops forever at low volume
 *   2. Cycling: 5 soundscapes play in sequence, one at a time, then loop the set
 *
 * DATA_DIR is patched to the API /ambient URL by `clea ambiance on`.
 */

import { spawn } from 'child_process';

const DATA_DIR = 'AMBIENT_BASE_URL';

const BOWLS = [
  { file: 'bowl-reverb.mp3', volume: 0.18 },
  { file: 'bowl-mid.mp3',    volume: 0.15 },
  { file: 'bowl-3.mp3',      volume: 0.15 },
  { file: 'bowl-deep.mp3',   volume: 0.20 },
];

// silence between bowl strikes (ms)
const BOWL_PAUSE_MIN = 8000;
const BOWL_PAUSE_MAX = 22000;

const SOUNDSCAPES = [
  { file: 'scene-storm-arrives.mp3', volume: 0.55 },
  { file: 'scene-deluge.mp3',        volume: 0.50 },
  { file: 'scene-forest-edge.mp3',   volume: 0.50 },
  { file: 'scene-drops.mp3',         volume: 0.45 },
  { file: 'scene-deep-jungle.mp3',   volume: 0.50 },
];

export class AmbientPlayer {
  constructor() {
    this._bowlProc = null;
    this._sceneProc = null;
    this._bowlIndex = 0;
    this._sceneIndex = 0;
    this._running = false;
    this._bowlTimer = null;
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._strikeBowl();
    this._startScene();
  }

  _strikeBowl() {
    const bowl = BOWLS[this._bowlIndex % BOWLS.length];
    this._bowlIndex++;

    this._bowlProc = spawn('ffplay', [
      '-nodisp', '-loop', '1',
      '-t', '25',
      '-af', `volume=${bowl.volume}`,
      '-loglevel', 'quiet',
      `${DATA_DIR}/${bowl.file}`,
    ]);

    this._bowlProc.on('close', () => {
      if (!this._running) return;
      const pause = BOWL_PAUSE_MIN + Math.random() * (BOWL_PAUSE_MAX - BOWL_PAUSE_MIN);
      this._bowlTimer = setTimeout(() => this._strikeBowl(), pause);
    });
  }

  _startScene() {
    const scene = SOUNDSCAPES[this._sceneIndex % SOUNDSCAPES.length];
    this._sceneProc = spawn('ffplay', [
      '-nodisp', '-loop', '1',
      '-af', `volume=${scene.volume}`,
      '-loglevel', 'quiet',
      `${DATA_DIR}/${scene.file}`,
    ]);

    this._sceneProc.on('close', () => {
      if (!this._running) return;
      this._sceneIndex++;
      this._startScene();
    });
  }

  stop() {
    this._running = false;
    if (this._bowlTimer) { clearTimeout(this._bowlTimer); this._bowlTimer = null; }
    this._bowlProc?.kill('SIGTERM');
    this._sceneProc?.kill('SIGTERM');
    this._bowlProc = null;
    this._sceneProc = null;
  }
}
