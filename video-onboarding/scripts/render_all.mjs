import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STUDIO_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(STUDIO_ROOT, '..');
const OUT_DIR = path.join(STUDIO_ROOT, 'out');
const ASSETS_VIDEO_DIR = path.join(REPO_ROOT, 'assets', 'video');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FFMPEG_BIN = fs.existsSync('/usr/local/bin/ffmpeg') ? '/usr/local/bin/ffmpeg' : 'ffmpeg';
const CWEBP_BIN = fs.existsSync('/usr/local/bin/cwebp') ? '/usr/local/bin/cwebp' : 'cwebp';
const REMOTION_BIN = path.join(STUDIO_ROOT, 'node_modules', '.bin', 'remotion');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(ASSETS_VIDEO_DIR, { recursive: true });

/**
 * Procedurally synthesize a crisp 9.5s beat-synced spatial WAV soundtrack (44.1kHz stereo)
 * matching all 3 Acts of PapyrusIllusionIntro (zero external downloads).
 */
function synthesizeSoundtrackWav(outPath) {
  const sampleRate = 44100;
  const durationSec = 9.5;
  const numSamples = Math.floor(sampleRate * durationSec);
  const left = new Float32Array(numSamples);
  const right = new Float32Array(numSamples);

  // Deterministic pseudo-noise generator for soft shimmer / whoosh sweeps
  let seed = 1337;
  const nextNoise = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 0xffffffff) * 2 - 1;
  };

  const addTone = (startSec, durSec, freqHz, amp, pan = 0, attack = 0.02) => {
    const startIdx = Math.max(0, Math.floor(startSec * sampleRate));
    const endIdx = Math.min(numSamples, Math.floor((startSec + durSec) * sampleRate));
    const panL = Math.cos(((pan + 1) * Math.PI) / 4);
    const panR = Math.sin(((pan + 1) * Math.PI) / 4);

    for (let i = startIdx; i < endIdx; i++) {
      const t = (i - startIdx) / sampleRate;
      const envIn = Math.min(1, t / Math.max(0.005, attack));
      const envOut = Math.exp((-3.4 * t) / Math.max(0.08, durSec));
      const env = envIn * envOut;
      const wave =
        Math.sin(2 * Math.PI * freqHz * t) * 0.72 +
        Math.sin(2 * Math.PI * freqHz * 2 * t) * 0.2 +
        Math.sin(2 * Math.PI * freqHz * 3 * t) * 0.08;
      const s = wave * amp * env;
      left[i] += s * panL;
      right[i] += s * panR;
    }
  };

  const addWhoosh = (centerSec, widthSec, amp, pitchSweepStart, pitchSweepEnd) => {
    const startIdx = Math.max(0, Math.floor((centerSec - widthSec) * sampleRate));
    const endIdx = Math.min(numSamples, Math.floor((centerSec + widthSec) * sampleRate));
    let lp = 0;
    for (let i = startIdx; i < endIdx; i++) {
      const rel = (i / sampleRate - centerSec) / widthSec; // -1 .. +1
      const env = Math.exp(-rel * rel * 4.2);
      const prog = (rel + 1) * 0.5;
      const freq = pitchSweepStart + (pitchSweepEnd - pitchSweepStart) * prog;
      const alpha = Math.min(0.4, (2 * Math.PI * freq) / sampleRate);
      lp += alpha * (nextNoise() - lp);
      const shimmer = Math.sin(2 * Math.PI * (freq * 0.5) * (i / sampleRate)) * 0.28;
      const val = (lp * 1.6 + shimmer) * amp * env;
      left[i] += val * (0.75 + 0.25 * Math.sin(rel * 2));
      right[i] += val * (0.75 - 0.25 * Math.sin(rel * 2));
    }
  };

  // Continuous deep spatial cosmic pad (D2 + A2 + F#3 warm halo)
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const masterFade = Math.min(1, t / 0.4) * Math.min(1, Math.max(0, (durationSec - t) / 0.65));
    const padLow = Math.sin(2 * Math.PI * 73.42 * t) * 0.14 + Math.sin(2 * Math.PI * 110.0 * t) * 0.09;
    const padAir = Math.sin(2 * Math.PI * 293.66 * t + Math.sin(t * 1.4) * 0.35) * 0.045;
    const act1Tension = t < 3.0 ? Math.sin(2 * Math.PI * 220 * t) * 0.03 * (1 - t / 3.0) : 0;
    const pulse = t < 2.9 ? Math.pow(0.5 + 0.5 * Math.sin(2 * Math.PI * 2.5 * t), 6) * 0.05 : 0;
    const s = (padLow + padAir + act1Tension + pulse) * masterFade;
    left[i] += s;
    right[i] += s;
  }

  // Beat 1->2 (3.0s): Golden Laser Blade Whoosh + Bright Spark Impact
  addWhoosh(3.0, 0.42, 0.24, 240, 1850);
  addTone(3.02, 0.9, 587.33, 0.22, -0.15, 0.01); // D5
  addTone(3.04, 0.85, 880.0, 0.16, 0.2, 0.015); // A5

  // Beat 2B (4.25s): Portal Match-Cut Swoosh
  addWhoosh(4.35, 0.38, 0.26, 180, 2200);
  addTone(4.45, 0.65, 1174.66, 0.14, 0, 0.015); // D6

  // Beat 2C: 3 Crystalline Chimes synced dead-on to Feature Cards 01, 02, 03
  addTone(4.75, 0.55, 739.99, 0.18, -0.35, 0.008); // F#5
  addTone(5.28, 0.55, 880.0, 0.19, 0.0, 0.008);    // A5
  addTone(5.82, 0.65, 1174.66, 0.21, 0.35, 0.008); // D6

  // Beat 3 (6.8s -> 9.5s): Warm Triumphant Major-9th Resolve Chord (D4-A4-E5-F#5-D6)
  addWhoosh(6.8, 0.35, 0.16, 400, 1400);
  addTone(6.85, 2.5, 293.66, 0.15, -0.25, 0.08); // D4
  addTone(6.88, 2.5, 440.0, 0.13, 0.25, 0.08);   // A4
  addTone(6.92, 2.4, 587.33, 0.12, -0.1, 0.09);  // D5
  addTone(6.96, 2.4, 659.25, 0.1, 0.3, 0.1);     // E5
  addTone(7.0, 2.3, 739.99, 0.11, -0.2, 0.1);    // F#5

  // Write 16-bit stereo PCM WAV
  const bytesPerSample = 2;
  const dataSize = numSamples * 2 * bytesPerSample;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const l = Math.max(-0.96, Math.min(0.96, left[i]));
    const r = Math.max(-0.96, Math.min(0.96, right[i]));
    buf.writeInt16LE(Math.round(l * 32767), offset);
    buf.writeInt16LE(Math.round(r * 32767), offset + 2);
    offset += 4;
  }

  fs.writeFileSync(outPath, buf);
  console.log(`Synthesized spatial soundtrack -> ${outPath} (${(buf.length / 1024).toFixed(1)} KB)`);
}

function run(cmd, args, cwd = STUDIO_ROOT) {
  console.log(`> ${path.basename(cmd)} ${args.join(' ')}`);
  execFileSync(cmd, args, { cwd, stdio: 'inherit' });
}

const chromeArgs = fs.existsSync(CHROME_PATH) ? [`--browser-executable=${CHROME_PATH}`] : [];

// 1. Synthesize beat-synced soundtrack
const wavPath = path.join(OUT_DIR, 'soundtrack.wav');
synthesizeSoundtrackWav(wavPath);

// 2. Render 4 verification preview stills (for visual inspection + poster generation)
const stills = [
  { frame: 40, file: 'preview_act1_poster.png' },
  { frame: 112, file: 'preview_act2_morph.png' },
  { frame: 186, file: 'preview_act2_cards.png' },
  { frame: 258, file: 'preview_act3_payoff.png' },
];
for (const { frame, file } of stills) {
  run(REMOTION_BIN, [
    'still',
    'src/index.ts',
    'PapyrusIllusionIntro',
    path.join(OUT_DIR, file),
    `--frame=${frame}`,
    ...chromeArgs,
  ]);
}

// 3. Render crisp Remotion master video (video-only, high quality before dual FFmpeg encode)
const rawMaster = path.join(OUT_DIR, 'master_raw.mp4');
run(REMOTION_BIN, [
  'render',
  'src/index.ts',
  'PapyrusIllusionIntro',
  rawMaster,
  '--codec=h264',
  '--crf=16',
  '--muted',
  ...chromeArgs,
]);

// 4. Encode production MP4 (H.264 Main + faststart + AAC 96k, target < 1.5 MB)
const outMp4 = path.join(ASSETS_VIDEO_DIR, 'onboarding_illusion.mp4');
run(FFMPEG_BIN, [
  '-y',
  '-i', rawMaster,
  '-i', wavPath,
  '-c:v', 'libx264',
  '-profile:v', 'main',
  '-level', '4.0',
  '-pix_fmt', 'yuv420p',
  '-crf', '24',
  '-preset', 'slow',
  '-movflags', '+faststart',
  '-c:a', 'aac',
  '-b:a', '96k',
  '-shortest',
  outMp4,
]);

// 5. Encode production WebM (VP9 + Opus 64k for Web, target < 900 KB)
const outWebm = path.join(ASSETS_VIDEO_DIR, 'onboarding_illusion.webm');
run(FFMPEG_BIN, [
  '-y',
  '-i', rawMaster,
  '-i', wavPath,
  '-c:v', 'libvpx-vp9',
  '-crf', '42',
  '-b:v', '0',
  '-cpu-used', '2',
  '-row-mt', '1',
  '-pix_fmt', 'yuv420p',
  '-c:a', 'libopus',
  '-b:a', '64k',
  '-shortest',
  outWebm,
]);

// 6. Encode 0ms Poster Frame WebP via cwebp (target < 40 KB)
const outPoster = path.join(ASSETS_VIDEO_DIR, 'onboarding_poster.webp');
run(CWEBP_BIN, [
  '-q', '80',
  '-m', '6',
  path.join(OUT_DIR, 'preview_act1_poster.png'),
  '-o', outPoster,
]);

// Print final size audit
for (const target of [outMp4, outWebm, outPoster]) {
  const bytes = fs.statSync(target).size;
  console.log(`FINAL ASSET: ${path.relative(REPO_ROOT, target)} = ${(bytes / 1024).toFixed(1)} KB`);
}
