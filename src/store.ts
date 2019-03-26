import { observable } from "mobx"
import { createAnalyser, Detector, Event, Framer, Signature, SigRecorder } from "./detector"

type FrameFn = (time :DOMHighResTimeStamp, frame :Uint8Array) => void

const MaxEventAge = 10 * 1000 // 10s

export class AudioStore {
  ctx = new AudioContext()
  analyser = createAnalyser(this.ctx)
  frames = new Framer(100) // TODO: how many frames to track?
  detector = new Detector(this.frames)

  readonly frame = new Uint8Array(this.analyser.frequencyBinCount);
  events :Event[] = []

  @observable time :DOMHighResTimeStamp = 0
  @observable sigs :Signature[] = []

  modeFn :FrameFn|void = undefined
  recorder :SigRecorder|void = undefined

  start () {
    const {analyser} = this
    navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(stream => {
      var source = this.ctx.createMediaStreamSource(stream)
      source.connect(analyser)
    })

    const renderFrame = (time :DOMHighResTimeStamp) => {
      const frame = this.frame
      requestAnimationFrame(renderFrame)
      analyser.getByteFrequencyData(frame)
      const event = this.frames.update(time, frame)
      event && this.addEvent(time, event)
      this.time = time

      const modeFn = this.modeFn
      if (modeFn) modeFn(time, frame)
      else {
        const event = this.detector.update(time, this.sigs)
        if (event) {
          console.log(`Event: ${event.sig.name} // ${event.error}`)
        }
      }
    }
    requestAnimationFrame(renderFrame)
  }

  addEvent (time :DOMHighResTimeStamp, event :Event) {
    let xii = 0, events = this.events
    const expired = time - MaxEventAge
    while (events.length > xii && events[xii].startTime < expired) xii += 1
    if (xii > 0) events.splice(0, xii)
    events.push(event)
    console.log(`Added event @ ${event.startTime} / ${event.energies}`)
  }

  // recordSig (name :string) {
  //   const recorder = new SigRecorder()
  //   console.log(`Recording signature '${name}'...`)
  //   this.modeFn = (time, frame) => {
  //     if (recorder.update(time, frame)) {
  //       this.sigs.push(recorder.frames.mkSig(name))
  //       this.modeFn = undefined
  //     }
  //   }
  // }
}
