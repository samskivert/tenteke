import { observable, observe } from "mobx"
import { createAnalyser, OnsetDetector, Event, Framer, Signature, SigRecorder } from "./detector"

type FrameFn = (time :DOMHighResTimeStamp, frame :Uint8Array) => void

const MaxEventAge = 10 * 1000 // 10s

const TrackFrames = 60 * 10 // 10s @ 60 fps

export class AudioStore {
  ctx = new AudioContext()
  analyser = createAnalyser(this.ctx)

  @observable filterFreq = 8192
  @observable filterQ = 1
  filter = new BiquadFilterNode(this.ctx, {
    type: "bandpass",
    frequency: this.filterFreq,
    Q: this.filterQ,
    detune: 100
  })

  frames = new Framer(100) // TODO: how many frames to track?
  // detector = new Detector(this.frames)
  onsettor = new OnsetDetector(10)

  readonly frame = new Uint8Array(this.analyser.frequencyBinCount);
  readonly fframe = new Float32Array(this.analyser.frequencyBinCount);
  readonly samples = new Float32Array(this.analyser.fftSize)

  events :Event[] = []

  diffs :number[] = []
  times :number[] = []
  curFrame :number = 0

  @observable paused = false

  @observable time :DOMHighResTimeStamp = 0
  @observable sigs :Signature[] = []

  modeFn :FrameFn|void = undefined
  recorder :SigRecorder|void = undefined

  constructor () {
    observe(this, "paused", change => {
      if (change.oldValue && !change.newValue) requestAnimationFrame(this.renderFrame)
    })
    // make our filter values tweakable
    observe(this, "filterFreq", change => {
      this.filter.frequency.value = change.newValue
      console.log(`New Freq ${this.filter.frequency.value}`)
    })
    observe(this, "filterQ", change => {
      this.filter.Q.value = change.newValue
      console.log(`New Q ${this.filter.Q.value}`)
    })
    console.log(`Filter detune: ${this.filter.detune.value}`)
  }

  start () {
    // const {analyser, filter} = this
    const {analyser} = this
    navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(stream => {
      var source = this.ctx.createMediaStreamSource(stream)
      console.log(`Sample rate: ${this.ctx.sampleRate}`)
      // source.connect(filter)
      // filter.connect(analyser)
      source.connect(analyser)
    })

    requestAnimationFrame(this.renderFrame)
  }

  readonly renderFrame = (time :DOMHighResTimeStamp) => {
    if (!this.paused) requestAnimationFrame(this.renderFrame)
    const {analyser, frame, fframe, samples, curFrame} = this
    this.curFrame = curFrame + 1

    // TODO: compute appropriate sampling interval based on FFT params and set non-vsynced timer to
    // do audio frame calculations; then update viz in anim frame callback
    analyser.getFloatFrequencyData(fframe)
    analyser.getByteFrequencyData(frame)
    analyser.getFloatTimeDomainData(samples)

    const event = this.frames.update(time, frame)
    event && this.addEvent(time, event)

    const curIdx = curFrame % TrackFrames
    this.times[curIdx] = time
    this.diffs[curIdx] = this.onsettor.update(time, fframe)

    const modeFn = this.modeFn
    if (modeFn) modeFn(time, frame)
    else {
      // const event = this.detector.update(time, this.sigs)
      // if (event) {
      //   console.log(`Event: ${event.sig.name} // ${event.error}`)
      // }
    }

    // finally update current time to trigger observers
    this.time = time
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
