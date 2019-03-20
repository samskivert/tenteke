
/** The width of a signature in frequency buckets. */
const sigWidth = 16

/** The size of the FFT used when processing audio. Must be 2 x signature width. */
const fftSize = sigWidth * 2

/** The length of a signature, in frames. */
const sigLength = 10

const maxFreqEnergy = 256
const totalEnergy = sigWidth * maxFreqEnergy
const minStartEnergy = 0.25 * totalEnergy // TODO: tune

const maxError = maxFreqEnergy / 8 // TODO: tune
const maxErrorSq = (maxError * maxError) * sigLength

const minBeatDelta = 200 // ms

/** Creates an audio analyser node, prepared appropriately for recording and detecting strikes. */
export function createAnalyser (ctx :AudioContext) :AnalyserNode {
  const alz = ctx.createAnalyser()
  alz.fftSize = fftSize
  alz.smoothingTimeConstant = 0.01 // TODO: tune?
  return alz
}

/** Returns the total "energy" of the frame (the sum of the energy at each frequency component). */
function computeEnergy (frame :Uint8Array) :number {
  let sum = 0
  for (let ii = 0, ll = frame.length; ii < ll; ii += 1) {
    // TODO: should this be scaled by the bucket frequency? physics!
    sum += frame[ii]
  }
  return sum
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

  error (frames :Frames) :number {
    const scount = this.frames.length, fcount = frames.size
    let error = 0
    for (let ii = 0, idx = frames.nextFrame; ii < scount; ii += 1, idx = (idx+1) % fcount) {
      error += computeError(this.frames[ii], frames.frames[idx])
    }
    return error
  }
}

class Frames {
  frames :Uint8Array[] = []
  energies :number[] = []
  times :DOMHighResTimeStamp[] = []
  nextFrame = 0

  constructor (readonly size :number) {
    for (let ii = 0; ii < size; ii += 1) {
      this.frames[ii] = new Uint8Array(sigWidth)
      this.energies[ii] = 0
    }
  }

  update (time :DOMHighResTimeStamp, frame :Uint8Array) {
    const {frames, energies, times} = this
    const curFrame = this.nextFrame
    frames[curFrame].set(frame)
    energies[curFrame] = computeEnergy(frame)
    times[curFrame] = time
    this.nextFrame = (curFrame + 1) % sigLength
  }

  mkFrames () :Uint8Array[] {
    const {frames, size} = this
    const sigFrames = []
    for (let ii = 0, idx = this.nextFrame; ii < size; ii += 1, idx = (idx+1) % size) {
      sigFrames[ii] = frames[idx]
    }
    return sigFrames
  }

  mkSig (name :string) :Signature {
    return new Signature(name, this.mkFrames())
  }
}

/** Used to record a strike signature. Create an instance, feed it audio frames until it returns
  * true from `update` to indicate that it has detected a strike signature. Then obtain the
  * signature via `signature`.
  */
export class SigRecorder {
  frames = new Frames(sigLength)

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
        console.log(`Non-decreasing frame energy: ${cc} // ${this.frames.mkFrames().map(computeEnergy)}`)
        return false
      }
    }

    // TODO: what else?

    return true
  }
}

type Strike = {
  startTime :DOMHighResTimeStamp
  detectTime :DOMHighResTimeStamp
  sig :Signature
  error :number
}

export class Detector {
  frames = new Frames(sigLength)
  lastMatchTime = 0

  update (time :DOMHighResTimeStamp, frame :Uint8Array, sigs :Signature[]) :Strike|void {
    const frames = this.frames
    frames.update(time, frame)

    // if we have nothing to match, stop now
    if (sigs.length == 0) return undefined

    // delay a bit after each match so that we don't repeat match on strikes with longer decay
    if (time - this.lastMatchTime < minBeatDelta) return undefined

    // if the first frame lacks sufficient total energy, no match
    const {energies, times, nextFrame} = frames
    if (energies[nextFrame] < minStartEnergy) {
      // console.log(`First frame energy: ${energies[nextFrame]}`)
      return undefined
    }

    // find the best matching signature
    let minSig = sigs[0]
    let minError = minSig.error(frames)
    for (let ii = 1, ll = sigs.length; ii < ll; ii += 1) {
      let sig = sigs[ii]
      let sigError = sig.error(frames)
      if (sigError < minError) {
        minSig = sig
        minError = sigError
      }
    }

    console.log(`Best sig: ${minSig.name} error: ${minError} (${maxErrorSq})`)

    // if the best isn't good enough, no matches
    if (minError > maxErrorSq) return undefined

    this.lastMatchTime = time
    return {startTime: times[nextFrame], detectTime: time, sig: minSig, error: minError}
  }
}
