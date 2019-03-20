import { observable } from "mobx"
import { createAnalyser, Signature, SigRecorder, Detector } from "./detector"

type FrameFn = (time :DOMHighResTimeStamp, frame :Uint8Array) => void

export class AudioStore {
  ctx = new AudioContext()
  analyser = createAnalyser(this.ctx)
  detector = new Detector()

  @observable sigs :Signature[] = []

  modeFn :FrameFn|void = undefined
  recorder :SigRecorder|void = undefined

  start (onFrame :FrameFn) {
    const {analyser} = this
    navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(stream => {
      var source = this.ctx.createMediaStreamSource(stream)
      source.connect(analyser)
    })

    // analyser.connect(actx.destination)
    const frame = new Uint8Array(analyser.frequencyBinCount);
    const renderFrame = (time :DOMHighResTimeStamp) => {
      requestAnimationFrame(renderFrame)
      analyser.getByteFrequencyData(frame)
      const modeFn = this.modeFn
      if (modeFn) modeFn(time, frame)
      else {
        const event = this.detector.update(time, frame, this.sigs)
        if (event) {
          console.log(`Event: ${event.sig.name} // ${event.error}`)
        }
      }
      onFrame(time, frame)
    }
    requestAnimationFrame(renderFrame)
  }

  recordSig (name :string) {
    const recorder = new SigRecorder()
    console.log(`Recording signature '${name}'...`)
    this.modeFn = (time, frame) => {
      if (recorder.update(time, frame)) {
        this.sigs.push(recorder.frames.mkSig(name))
        this.modeFn = undefined
      }
    }
  }
}
