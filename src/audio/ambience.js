// Subtle library-café background music, synthesised live with Web Audio (no audio files, no licensing).
// Mellow electric-piano jazz chords, a soft upright bass, barely-there brushes and the odd
// vibraphone note, in a small warm room, with a light patter of rain and faint record crackle.

const BPM = 66
const BEAT = 60 / BPM
const BAR = BEAT * 4

// Eight bars of gentle jazz harmony in D: rich, unresolved chords that never push anywhere.
const BARS = [
  { bass: 38, chord: [54, 57, 61, 64] }, // Dmaj9
  { bass: 47, chord: [57, 61, 62, 66] }, // Bm9
  { bass: 40, chord: [55, 59, 62, 66] }, // Em9
  { bass: 45, chord: [55, 59, 61, 66] }, // A13
  { bass: 43, chord: [54, 57, 59, 62] }, // Gmaj9
  { bass: 42, chord: [52, 57, 61, 64] }, // F#m7
  { bass: 40, chord: [55, 59, 62, 66] }, // Em9
  { bass: 45, chord: [55, 59, 61, 66] }, // A13
]
const MELODY = [69, 71, 73, 74, 76, 78, 81] // D major, upper middle register

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12)
const rand = (a, b) => a + Math.random() * (b - a)

let ctx = null
let master = null
let bus = null
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
      last = (last + 0.02 * w) / 1.02 // integrated noise: a soft, low hush
      d[i] = last * 3.5
    } else d[i] = w
  }
  return buf
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

function loop(buffer, ...chain) {
  const s = ctx.createBufferSource()
  s.buffer = buffer
  s.loop = true
  chain.reduce((a, b) => a.connect(b), s)
  s.start(0, Math.random() * buffer.duration)
}

function setup() {
  ctx = new (window.AudioContext || window.webkitAudioContext)()
  master = gain(0)
  master.connect(ctx.destination)

  // warm, rounded tone and a small cosy room
  const tone = filter('lowpass', 2600, 0.4)
  tone.connect(master)
  const room = ctx.createConvolver()
  room.buffer = impulse(2.4, 3)
  room.connect(gain(0.3)).connect(tone)
  bus = gain(1)
  bus.connect(tone)
  bus.connect(room)

  // light rain on the window, kept well under the music
  rainBus = gain(1)
  rainBus.connect(master)
  loop(noiseBuffer(7, true), filter('lowpass', 800), filter('highpass', 140), gain(0.045), rainBus)
  loop(noiseBuffer(5), filter('highpass', 3000), filter('lowpass', 7500), gain(0.004), rainBus)

  // faint record crackle
  const crackle = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate)
  const cd = crackle.getChannelData(0)
  for (let i = 0; i < cd.length; i++) if (Math.random() < 0.00025) cd[i] = (Math.random() * 2 - 1) * 0.5
  loop(crackle, gain(0.02), master)
}

// Electric piano: a sine body with a soft bell on the attack, mellowed right down.
function keys(midi, t, dur, vel) {
  const f = hz(midi)
  const out = ctx.createGain()
  out.gain.setValueAtTime(0, t)
  out.gain.linearRampToValueAtTime(vel, t + 0.025)
  out.gain.exponentialRampToValueAtTime(vel * 0.4, t + 0.7)
  out.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  const pan = ctx.createStereoPanner()
  pan.pan.value = rand(-0.25, 0.25)
  out.connect(pan).connect(bus)
  const car = ctx.createOscillator()
  car.frequency.value = f
  car.detune.value = rand(-4, 4)
  const mod = ctx.createOscillator()
  mod.frequency.value = f * 2
  const modGain = ctx.createGain()
  modGain.gain.setValueAtTime(f * 0.5, t)
  modGain.gain.exponentialRampToValueAtTime(f * 0.02, t + 0.35)
  mod.connect(modGain).connect(car.frequency)
  car.connect(out)
  car.start(t)
  mod.start(t)
  car.stop(t + dur + 0.05)
  mod.stop(t + dur + 0.05)
}

// Soft upright bass: a rounded pluck that blooms and fades.
function bass(midi, t, dur) {
  const o = ctx.createOscillator()
  o.type = 'triangle'
  o.frequency.value = hz(midi)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.13, t + 0.03)
  g.gain.exponentialRampToValueAtTime(0.05, t + 0.35)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(filter('lowpass', 320, 0.5)).connect(g).connect(bus)
  o.start(t)
  o.stop(t + dur + 0.05)
}

// Vibraphone: pure tone with a slow shimmer.
function vibes(midi, t, vel) {
  const o = ctx.createOscillator()
  o.frequency.value = hz(midi)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vel, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6)
  // shimmer in its own stage, so it fades out with the note
  const shimmer = gain(1)
  const trem = ctx.createOscillator()
  trem.frequency.value = 4.5
  trem.connect(gain(0.3)).connect(shimmer.gain)
  o.connect(shimmer).connect(g).connect(bus)
  ;[o, trem].forEach((n) => {
    n.start(t)
    n.stop(t + 2.7)
  })
}

// A brush swept across the snare: a long, quiet hiss.
function brush(t, vel, len = 0.35) {
  const s = ctx.createBufferSource()
  s.buffer = brush.buf ||= noiseBuffer(1)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vel, t + len * 0.4)
  g.gain.exponentialRampToValueAtTime(0.0001, t + len)
  s.connect(filter('bandpass', 2400, 0.6)).connect(g).connect(bus)
  s.start(t, Math.random() * 0.5)
  s.stop(t + len + 0.05)
}

function scheduleBar(t, n) {
  const { bass: root, chord } = BARS[n % BARS.length]
  const swing = BEAT * 0.16
  const ease = () => rand(-0.012, 0.02)

  // chord, gently rolled, with a lighter comp later in the bar
  chord.forEach((m, k) => keys(m, t + k * 0.03 + ease(), BAR * 0.95, 0.04))
  if (Math.random() < 0.6) chord.slice(1).forEach((m, k) => keys(m, t + BEAT * 2.5 + swing + k * 0.025, BEAT * 1.3, 0.016))

  // bass on one and three, walking up into the next bar now and then
  if (n >= 1) {
    bass(root, t, BEAT * 1.8)
    bass(root + 7, t + BEAT * 2, BEAT * 1.4)
    if (Math.random() < 0.4) bass(root + 9, t + BEAT * 3.5 + swing, BEAT * 0.5)
  }

  // barely-there brushes on two and four
  if (n >= 2) {
    brush(t + BEAT, 0.018)
    brush(t + BEAT * 3, 0.018)
    if (Math.random() < 0.5) brush(t + BEAT * 3.5 + swing, 0.008, 0.18)
  }

  // an occasional vibraphone phrase floating over the top
  if (n >= 4 && Math.random() < 0.55) {
    let at = Math.floor(rand(0, 4)) * (BEAT / 2)
    const count = 1 + Math.floor(Math.random() * 3)
    for (let k = 0; k < count && at < BAR; k++) {
      vibes(MELODY[Math.floor(Math.random() * MELODY.length)], t + at + ease(), 0.035)
      at += BEAT * (1 + Math.floor(Math.random() * 2))
    }
  }
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
  master.gain.setTargetAtTime(0.8, ctx.currentTime, 1.6) // slow fade in
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
