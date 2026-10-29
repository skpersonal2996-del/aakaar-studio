// Quiet old-library ambience, synthesised live with Web Audio (no audio files, no licensing).
// A slow felt-piano waltz with soft string swells in a big, warm room, rain on the windows
// underneath, and a faint record crackle for that old-reading-room feel.

const BPM = 58
const BEAT = 60 / BPM
const BAR = BEAT * 3 // a slow waltz

// An unhurried eight-bar loop in D major: bass note, then the chord on beats two and three.
const BARS = [
  { bass: 38, chord: [57, 61, 66] }, // Dmaj7
  { bass: 43, chord: [59, 62, 66] }, // Gmaj7
  { bass: 47, chord: [57, 62, 66] }, // Bm7
  { bass: 43, chord: [59, 62, 66] }, // Gmaj7
  { bass: 40, chord: [55, 59, 62, 66] }, // Em9
  { bass: 45, chord: [55, 59, 62, 64] }, // A7sus4
  { bass: 38, chord: [57, 61, 66] }, // Dmaj7
  { bass: 43, chord: [59, 61, 66] }, // Gmaj7(#11)
]

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12)
const rand = (a, b) => a + Math.random() * (b - a)

let ctx = null
let master = null
let bus = null // music: dry + hall
let rainBus = null
let timer = null
let nextBar = 0
let bar = 0
let playing = false

function impulse(seconds, decay) {
  const len = ctx.sampleRate * seconds
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return buf
}

function noiseBuffer(seconds, brown = false) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1
    if (brown) {
      last = (last + 0.02 * w) / 1.02 // integrated noise: a deep, soft hush
      d[i] = last * 3.5
    } else d[i] = w
  }
  return buf
}

function loop(buffer, ...chain) {
  const s = ctx.createBufferSource()
  s.buffer = buffer
  s.loop = true
  chain.reduce((a, b) => a.connect(b), s)
  s.start(0, Math.random() * buffer.duration)
  return s
}

function filter(type, frequency, Q = 0.7) {
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = frequency
  f.Q.value = Q
  return f
}

function gain(value) {
  const g = ctx.createGain()
  g.gain.value = value
  return g
}

function setup() {
  ctx = new (window.AudioContext || window.webkitAudioContext)()
  master = gain(0)
  master.connect(ctx.destination)

  // warm, slightly dark tone for the music, then a long hall like a high-ceilinged reading room
  const tone = filter('lowpass', 3200, 0.4)
  tone.connect(master)
  const hall = ctx.createConvolver()
  hall.buffer = impulse(4.2, 3)
  hall.connect(gain(0.42)).connect(tone)
  bus = gain(1)
  bus.connect(tone)
  bus.connect(hall)

  // rain: a soft low hush plus a fine high patter, slowly breathing in and out
  rainBus = gain(1)
  rainBus.connect(master)
  const breathe = ctx.createOscillator()
  breathe.frequency.value = 0.04
  const breatheAmt = gain(0.25)
  breathe.connect(breatheAmt).connect(rainBus.gain)
  breathe.start()
  loop(noiseBuffer(7, true), filter('lowpass', 900), filter('highpass', 120), gain(0.09), rainBus)
  loop(noiseBuffer(5), filter('highpass', 2800), filter('lowpass', 8000), gain(0.008), rainBus)

  // faint record crackle
  const crackle = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate)
  const cd = crackle.getChannelData(0)
  for (let i = 0; i < cd.length; i++) if (Math.random() < 0.00025) cd[i] = (Math.random() * 2 - 1) * 0.5
  loop(crackle, gain(0.025), master)
}

// Felt piano: a few soft harmonics, a gentle hammer, a long natural decay.
function piano(midi, t, vel, dur = 4.5) {
  const f = hz(midi)
  const out = ctx.createGain()
  out.gain.setValueAtTime(0, t)
  out.gain.linearRampToValueAtTime(vel, t + 0.012)
  out.gain.exponentialRampToValueAtTime(vel * 0.4, t + 0.5)
  out.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  const felt = filter('lowpass', Math.min(5000, f * 6), 0.3)
  const pan = ctx.createStereoPanner()
  pan.pan.value = Math.max(-0.6, Math.min(0.6, (midi - 60) / 30)) // low notes left, high right
  out.connect(felt).connect(pan).connect(bus)
  ;[
    [1, 1],
    [2, 0.35],
    [3, 0.12],
    [4, 0.05],
  ].forEach(([h, amp]) => {
    const o = ctx.createOscillator()
    o.frequency.value = f * h
    o.detune.value = rand(-3, 3)
    const g = gain(amp)
    o.connect(g).connect(out)
    o.start(t)
    o.stop(t + dur + 0.05)
  })
}

// Soft string section: detuned saws, heavily filtered, swelling in and out.
function strings(notes, t, dur) {
  const out = ctx.createGain()
  out.gain.setValueAtTime(0, t)
  out.gain.linearRampToValueAtTime(1, t + dur * 0.4)
  out.gain.linearRampToValueAtTime(0, t + dur)
  const lp = filter('lowpass', 900, 0.5)
  out.connect(lp).connect(bus)
  notes.forEach((m) => {
    ;[-7, 7].forEach((cents) => {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = hz(m)
      o.detune.value = cents
      const g = gain(0.006)
      o.connect(g).connect(out)
      o.start(t)
      o.stop(t + dur + 0.1)
    })
  })
}

// A single raindrop on the glass: a tiny, high tick.
function drop(t) {
  const s = ctx.createBufferSource()
  s.buffer = drop.buf ||= noiseBuffer(0.2)
  const bp = filter('bandpass', rand(2200, 5200), 6)
  const g = ctx.createGain()
  g.gain.setValueAtTime(rand(0.01, 0.035), t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03)
  const pan = ctx.createStereoPanner()
  pan.pan.value = rand(-0.8, 0.8)
  s.connect(bp).connect(g).connect(pan).connect(rainBus)
  s.start(t, Math.random() * 0.15)
  s.stop(t + 0.05)
}

function scheduleBar(t, n) {
  const { bass, chord } = BARS[n % BARS.length]
  const sway = () => rand(-0.02, 0.03) // a little rubato, like a person playing

  // the piano rests for the first two bars and lets the rain set the scene
  if (n >= 2) {
    piano(bass, t + sway(), 0.14, BAR * 1.6)
    piano(bass + 12, t + 0.03 + sway(), 0.05, BAR * 1.2)
    chord.forEach((m) => piano(m, t + BEAT + sway(), 0.05))
    chord.forEach((m) => piano(m, t + BEAT * 2 + sway(), 0.035))
  }
  // a quiet melody line, drifting over the chords
  if (n >= 4 && Math.random() < 0.75) {
    const tones = chord.map((m) => m + 12).concat(chord.map((m) => m + 24)).filter((m) => m <= 88)
    const count = Math.random() < 0.5 ? 1 : 2
    for (let k = 0; k < count; k++) {
      piano(tones[Math.floor(Math.random() * tones.length)], t + (k === 0 ? 0 : BEAT * (1 + Math.floor(Math.random() * 2))) + sway(), 0.07, BAR * 1.4)
    }
  }
  // strings swell every other bar
  if (n >= 4 && n % 2 === 0) strings(chord, t, BAR * 2)

  // scattered drops on the window
  const drops = 4 + Math.floor(Math.random() * 6)
  for (let k = 0; k < drops; k++) drop(t + Math.random() * BAR)
}

function tick() {
  while (nextBar < ctx.currentTime + 1.5) {
    scheduleBar(nextBar, bar++)
    nextBar += BAR
  }
}

export function startMusic() {
  if (!ctx) setup()
  ctx.resume()
  if (!timer) {
    nextBar = ctx.currentTime + 0.2
    timer = setInterval(tick, 250)
    tick()
  }
  playing = true
  master.gain.cancelScheduledValues(ctx.currentTime)
  master.gain.setTargetAtTime(1, ctx.currentTime, 1.6) // slow fade in; still peaks around a quarter of full scale
}

export function stopMusic() {
  if (!ctx || !playing) return
  playing = false
  master.gain.cancelScheduledValues(ctx.currentTime)
  master.gain.setTargetAtTime(0, ctx.currentTime, 0.5)
  setTimeout(() => {
    if (playing) return
    clearInterval(timer)
    timer = null
    ctx.suspend()
  }, 2500)
}
