
/** The target number of frequency bands. */
const bands = 256

/** The size of the FFT used when processing audio. Must be `2 x bands`. */
const fftSize = bands * 2

/** The length of a signature, in frames. */
const sigLength = 10

// const maxSigFrames = 30 // 30 frames ~ half a second

const maxFreqEnergy = 256
const minStartEnergy = 0.25 // TODO: tune

const soundStartEnergy = 0.15
const soundEndEnergy = 0.10

// const maxError = maxFreqEnergy / 8 // TODO: tune
// const maxErrorSq = (maxError * maxError) * sigLength

// const minBeatDelta = 200 // ms
const minSoundFrames = 2

// we only use the low 1/4th of the spectrum to compute sound "energy"
const energyFreqs = bands/2

/** Creates an audio analyser node, prepared appropriately for recording and detecting strikes. */
export function createAnalyser (ctx :AudioContext) :AnalyserNode {
  const alz = ctx.createAnalyser()
  alz.fftSize = fftSize
  alz.smoothingTimeConstant = 0 // TODO: tune?
  return alz
}

/** Returns the total "energy" of the frame (the sum of the energy at each frequency component) as a
  * fraction of the maximum total energy. */
export function computeEnergy (frame :Uint8Array) :number {
  let sum = 0, freqs = 0
  const skipFreqs = 2 // skip two lowest frequency bands...?
  for (let ii = skipFreqs, ll = energyFreqs; ii < ll; ii += 1, freqs += 1) {
    const freqEnergy = frame[ii]
    // TODO: should this be scaled by the bucket frequency? physics!
    sum += freqEnergy / maxFreqEnergy
  }
  return sum / freqs
}

/** Computes the mean squared error between `frameA` and `frameB`. */
function computeError (frameA :Uint8Array, frameB :Uint8Array) :number {
  let error = 0
  for (let ii = 0, ll = frameA.length; ii < ll; ii += 1) {
    const diff = frameA[ii] - frameB[ii]
    error += diff*diff
  }
  return error/frameA.length
}

export class Signature {
  energy :number[]

  constructor (readonly name :string, readonly frames :Uint8Array[]) {
    this.energy = frames.map(computeEnergy)
  }

  error (frames :Framer) :number {
    const scount = this.frames.length, fcount = frames.size
    let error = 0
    for (let ii = 0, idx = frames.nextFrame; ii < scount; ii += 1, idx = (idx+1) % fcount) {
      error += computeError(this.frames[ii], frames.frames[idx])
    }
    return error
  }
}

export type Event = {
  startTime :DOMHighResTimeStamp
  detectTime :DOMHighResTimeStamp
  energies :number[]
  times :DOMHighResTimeStamp[]
  // TODO: include actual sound frames?
}

// type State = "idle" | "started" | "detected" | "overflowed"

// used in computing spectral difference: M frames of history are averaged to compute the
// "previous" frame
const M = 3

// TODO: limit relevant bands to 300-5000Hz?
const MinBand = 0
const MaxBand = bands

export class OnsetDetector {
  frames :Float32Array[] = []
  times :DOMHighResTimeStamp[] = []
  diffs :number[] = []
  curDiff :Float32Array = new Float32Array(bands)
  nextFrame = 0

  constructor (readonly size :number) {
    for (let ii = 0; ii < size; ii += 1) {
      this.frames[ii] = new Float32Array(bands)
      this.diffs[ii] = 0
    }
  }

  update (time :DOMHighResTimeStamp, frame :Float32Array) :number {
    // TODO: modulate frame bins based on equal loudness contour

    const {frames, times, diffs, curDiff, size} = this
    const curFrame = this.nextFrame
    this.nextFrame = curFrame + 1
    const curIdx = curFrame % size
    frames[curIdx].set(frame)
    times[curIdx] = time

    let diff = 0
    for (let bb = MinBand; bb < MaxBand; bb += 1) {
      // compute the average energy for the previous M frames
      let prevEnergy = 0
      for (let mm = 1; mm <= M; mm += 1) {
        prevEnergy += frames[(curFrame-mm)%size][bb]
      }
      // spectral difference is this frame's energy minus averaged energy (clamped to >=0)
      let bandDiff = Math.max(frame[bb] - prevEnergy, 0)
      curDiff[bb] = bandDiff
      diff += bandDiff
    }
    // total spectral difference is sum of (clamped) per-band differences
    return diffs[curFrame] = diff
  }
}

export class Framer {
  frames :Uint8Array[] = []
  times :DOMHighResTimeStamp[] = []
  energies :number[] = []

  nextFrame = 0
  startFrame = 0
  peakFrame = 0

  constructor (readonly size :number) {
    for (let ii = 0; ii < size; ii += 1) {
      this.frames[ii] = new Uint8Array(bands)
      this.energies[ii] = 0
    }
  }

  update (time :DOMHighResTimeStamp, frame :Uint8Array) :Event|void {
    const {frames, energies, times, size} = this
    const curFrame = this.nextFrame
    this.nextFrame = curFrame + 1
    const curIdx = curFrame % size, prevIdx = (curFrame-1) % size
    frames[curIdx].set(frame)
    times[curIdx] = time
    const energy = computeEnergy(frame)
    energies[curIdx] = energy

    let event :Event|void = undefined
    const startFrame = this.startFrame
    if (startFrame > 0) {
      // if the energy drops below the end energy threshold (decaying to quietude), or it jumps up
      // to a new high (start of a new strike while previous strike was decaying), pinch off this
      // strike and (potentially) start a new one
      const prevEnergy = energies[prevIdx]
      const peakEnergy = energies[this.peakFrame % size]
      if (energy < soundEndEnergy ||
          (energy > 1.25*prevEnergy && (curFrame - startFrame > minSoundFrames))) {
        const length = curFrame - startFrame, startIdx = startFrame % size
        event = {
          startTime: times[startIdx],
          detectTime: time,
          energies: this.mkEnergies(startFrame, length),
          times: this.mkTimes(startFrame, length),
        }
        this.startFrame = 0
      } else {
        if (energy > peakEnergy) {
          this.peakFrame = curFrame
        }
      }
    }

    if (this.startFrame == 0 && energy > soundStartEnergy) {
      this.startFrame = curFrame
      this.peakFrame = curFrame
    }

    return event
  }

  mkFrames (start :number, length :number) :Uint8Array[] {
    const {frames, size} = this
    const sigFrames = []
    for (let ii = 0; ii < length; ii += 1) sigFrames[ii] = frames[(start+ii) % size]
    return sigFrames
  }

  mkEnergies (start :number, length :number) :number[] {
    const {energies, size} = this
    const sigEnergies = []
    for (let ii = 0; ii < length; ii += 1) sigEnergies[ii] = energies[(start+ii) % size]
    return sigEnergies
  }

  mkTimes (start :number, length :number) :DOMHighResTimeStamp[] {
    const {times, size} = this
    const sigTimes = []
    for (let ii = 0; ii < length; ii += 1) sigTimes[ii] = times[(start+ii) % size]
    return sigTimes
  }

  mkSig (name :string) :Signature {
    return new Signature(name, this.mkFrames(this.nextFrame-this.size, this.size))
  }
}

/** Used to record a strike signature. Create an instance, feed it audio frames until it returns
  * true from `update` to indicate that it has detected a strike signature. Then obtain the
  * signature via `signature`.
  */
export class SigRecorder {
  frames = new Framer(sigLength)

  update (time :DOMHighResTimeStamp, frame :Uint8Array) :boolean {
    this.frames.update(time, frame)

    // if the first frame lacks sufficient total energy, no signature
    const {energies, nextFrame} = this.frames
    if (energies[nextFrame] < minStartEnergy) {
      // console.log(`First frame energy too low: ${energies[nextFrame]}`)
      return false
    }

    // if the energy history is not strictly decreasing, reject it (for strikes that have
    // measurable attack, we'll just catch them on the way down from their peak)
    const decrCount = Math.min(sigLength-1, 4)
    for (let cc = 0, idx = nextFrame; cc < decrCount; cc += 1, idx = (idx+1) % sigLength) {
      const nidx = (idx+1) % sigLength
      if (energies[idx] <= energies[nidx]) {
        console.log(`Non-decreasing frame energy: ${cc}`)
        return false
      }
    }

    // TODO: what else?

    return true
  }
}

export type Strike = {
  startTime :DOMHighResTimeStamp
  detectTime :DOMHighResTimeStamp
  sig :Signature
  error :number
}

// export class Detector {
//   lastMatchTime = 0

//   constructor (readonly frames :Framer) {}

//   update (time :DOMHighResTimeStamp, sigs :Signature[]) :Strike|void {
//     const frames = this.frames

//     // if we have nothing to match, stop now
//     if (sigs.length == 0) return undefined

//     // delay a bit after each match so that we don't repeat match on strikes with longer decay
//     if (time - this.lastMatchTime < minBeatDelta) return undefined

//     // if the first frame lacks sufficient total energy, no match
//     const {energies, times, nextFrame} = frames
//     if (energies[nextFrame] < minStartEnergy) {
//       // console.log(`First frame energy: ${energies[nextFrame]}`)
//       return undefined
//     }

//     // find the best matching signature
//     let minSig = sigs[0]
//     let minError = minSig.error(frames)
//     for (let ii = 1, ll = sigs.length; ii < ll; ii += 1) {
//       let sig = sigs[ii]
//       let sigError = sig.error(frames)
//       if (sigError < minError) {
//         minSig = sig
//         minError = sigError
//       }
//     }

//     console.log(`Best sig: ${minSig.name} error: ${minError} (${maxErrorSq})`)

//     // if the best isn't good enough, no matches
//     if (minError > maxErrorSq) return undefined

//     this.lastMatchTime = time
//     return {startTime: times[nextFrame], detectTime: time, sig: minSig, error: minError}
//   }
// }
