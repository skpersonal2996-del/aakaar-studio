// Generative coffee-shop lo-fi, synthesised live with Web Audio (no audio files, no licensing).
// Soft electric-piano chords, a gentle brushed beat, a sparse melody and vinyl crackle,
// all through a warm low-pass and a small room reverb.

const BPM = 74
const BEAT = 60 / BPM
const BAR = BEAT * 4

// Fmaj9 – Em7 – Dm9 – Cmaj7(add9), voiced low and close
const CHORDS = [
  [53, 57, 60, 64, 67],
  [52, 55, 59, 62, 66],
  [50, 53, 57, 60, 64],
  [48, 55, 59, 62, 64],
]
const BASS = [41, 40, 38, 36]
const SCALE = [72, 74, 76, 79, 81, 84] // C major pentatonic, upper register

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12)

let ctx = null
let master = null
let bus = null
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

function noiseBuffer(seconds) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return buf
}

function setup() {
  ctx = new (window.AudioContext || window.webkitAudioContext)()
  master = ctx.createGain()
  master.gain.value = 0
  master.connect(ctx.destination)

  // warm tape-ish tone: gentle low-pass with a slow wobble
  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 2400
  tone.Q.value = 0.4
  const wobble = ctx.createOscillator()
  const wobbleAmt = ctx.createGain()
  wobble.frequency.value = 0.15
  wobbleAmt.gain.value = 500
  wobble.connect(wobbleAmt).connect(tone.frequency)
  wobble.start()
  tone.connect(master)

  const reverb = ctx.createConvolver()
  reverb.buffer = impulse(2.6, 2.8)
  const wet = ctx.createGain()
  wet.gain.value = 0.32
  reverb.connect(wet).connect(tone)

  bus = ctx.createGain()
  bus.connect(tone)
  bus.connect(reverb)

  // vinyl crackle + hiss, always running underneath
  const hiss = ctx.createBufferSource()
  hiss.buffer = noiseBuffer(3)
  hiss.loop = true
  const hissFilter = ctx.createBiquadFilter()
  hissFilter.type = 'bandpass'
  hissFilter.frequency.value = 3500
  hissFilter.Q.value = 0.6
  const hissGain = ctx.createGain()
  hissGain.gain.value = 0.006
  hiss.connect(hissFilter).connect(hissGain).connect(master)
  hiss.start()

  const crackle = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate)
  const cd = crackle.getChannelData(0)
  for (let i = 0; i < cd.length; i++) if (Math.random() < 0.0004) cd[i] = (Math.random() * 2 - 1) * 0.6
  const crackSrc = ctx.createBufferSource()
  crackSrc.buffer = crackle
  crackSrc.loop = true
  const crackGain = ctx.createGain()
  crackGain.gain.value = 0.05
  crackSrc.connect(crackGain).connect(master)
  crackSrc.start()
}

// Rhodes-like voice: sine body + soft FM bell on the attack.
function keys(midi, t, dur, vel) {
  const f = hz(midi)
  const out = ctx.createGain()
  out.gain.setValueAtTime(0, t)
  out.gain.linearRampToValueAtTime(vel, t + 0.02)
  out.gain.exponentialRampToValueAtTime(vel * 0.35, t + 0.6)
  out.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  const pan = ctx.createStereoPanner()
  pan.pan.value = (Math.random() - 0.5) * 0.5
  out.connect(pan).connect(bus)

  const car = ctx.createOscillator()
  car.type = 'sine'
  car.frequency.value = f
  car.detune.value = (Math.random() - 0.5) * 8
  const mod = ctx.createOscillator()
  mod.frequency.value = f * 2
  const modGain = ctx.createGain()
  modGain.gain.setValueAtTime(f * 0.9, t)
  modGain.gain.exponentialRampToValueAtTime(f * 0.05, t + 0.4)
  mod.connect(modGain).connect(car.frequency)
  car.connect(out)
  car.start(t)
  mod.start(t)
  car.stop(t + dur + 0.05)
  mod.stop(t + dur + 0.05)
}

function bass(midi, t, dur) {
  const o = ctx.createOscillator()
  o.type = 'triangle'
  o.frequency.value = hz(midi)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.16, t + 0.04)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 380
  o.connect(lp).connect(g).connect(bus)
  o.start(t)
  o.stop(t + dur + 0.05)
}

function kick(t) {
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.frequency.setValueAtTime(110, t)
  o.frequency.exponentialRampToValueAtTime(42, t + 0.18)
  g.gain.setValueAtTime(0.32, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
  o.connect(g).connect(master)
  o.start(t)
  o.stop(t + 0.4)
}

const noise = () => {
  const s = ctx.createBufferSource()
  s.buffer = noise.buf ||= noiseBuffer(1)
  return s
}

// brushed snare / soft hat: filtered noise bursts
function brush(t, { freq, q, gain, len }) {
  const s = noise()
  const f = ctx.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = freq
  f.Q.value = q
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(gain, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + len)
  s.connect(f).connect(g).connect(bus)
  s.start(t, Math.random() * 0.5)
  s.stop(t + len + 0.05)
}

function scheduleBar(t, n) {
  const i = n % CHORDS.length
  const intro = n < 2 // first bars: just keys, then the beat comes in
  // chord, slightly strummed; re-voiced on the "and" of 3 with a lighter touch
  CHORDS[i].forEach((m, k) => keys(m, t + k * 0.018, BAR * 0.95, 0.05))
  CHORDS[i].slice(1, 4).forEach((m, k) => keys(m + 12, t + BEAT * 2.5 + k * 0.02, BEAT * 1.4, 0.018))
  bass(BASS[i], t, BEAT * 1.8)
  bass(BASS[i] + 7, t + BEAT * 2.5, BEAT * 1.2)

  if (!intro) {
    const swing = BEAT * 0.12
    kick(t)
    kick(t + BEAT * 2.5)
    if (Math.random() < 0.35) kick(t + BEAT * 3.5 + swing)
    brush(t + BEAT, { freq: 1800, q: 0.7, gain: 0.07, len: 0.22 })
    brush(t + BEAT * 3, { freq: 1800, q: 0.7, gain: 0.07, len: 0.22 })
    for (let h = 0; h < 8; h++) {
      const off = h % 2 ? swing : 0
      brush(t + h * (BEAT / 2) + off, { freq: 7500, q: 1.2, gain: h % 2 ? 0.012 : 0.02, len: 0.05 })
    }
  }

  // sparse, unhurried melody
  if (n >= 4 && Math.random() < 0.7) {
    const notes = 2 + Math.floor(Math.random() * 3)
    let at = Math.floor(Math.random() * 3)
    for (let k = 0; k < notes && at < 8; k++) {
      keys(SCALE[Math.floor(Math.random() * SCALE.length)], t + at * (BEAT / 2), BEAT * 1.6, 0.028)
      at += 1 + Math.floor(Math.random() * 3)
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
  master.gain.setTargetAtTime(0.55, ctx.currentTime, 1.2) // slow fade in
}

export function stopMusic() {
  if (!ctx || !playing) return
  playing = false
  master.gain.cancelScheduledValues(ctx.currentTime)
  master.gain.setTargetAtTime(0, ctx.currentTime, 0.4)
  setTimeout(() => {
    if (playing) return
    clearInterval(timer)
    timer = null
    ctx.suspend()
  }, 2000)
}
