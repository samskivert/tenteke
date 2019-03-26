import * as React from "react";
import { autorun } from "mobx"
import { observer } from "mobx-react"
import { AudioStore } from "./store"
import { Event } from "./detector"

const WIDTH = 290
const HEIGHT = 145

type Thunk = () => void

// var testNo = 0

@observer
export class SigList extends React.Component<{store :AudioStore}> {

  render () {
    const {store} = this.props
    const sigs = (store.sigs.length == 0) ? <div>No sigs.</div> :
      <ul>{store.sigs.map(sig => <li key={sig.name}>{sig.name}</li>)}</ul>

    return (
      <div>
        {sigs}
        <button onClick={_ => {
          // testNo += 1 ; store.recordSig(`Test ${testNo}`)
        }}>Add strike</button>
      </div>)
  }
}

function renderHisto (ctx :CanvasRenderingContext2D, data :Uint8Array, fps :number) {
  const {width, height} = ctx.canvas
  const buckets = data.length
  const barWidth = (width / buckets)-1
  let x = 0, barHeight = 0
  ctx.fillStyle = "#000"
  ctx.fillRect(0, 0, width, height)
  const heightScale = height / 256
  for (var ii = 0; ii < buckets; ii++) {
    barHeight = data[ii] * heightScale
    var r = data[ii] + (25 * (ii/buckets))
    var g = 250 * (ii/buckets)
    var b = 50
    ctx.fillStyle = "rgb(" + r + "," + g + "," + b + ")"
    ctx.fillRect(x, height - barHeight, barWidth, barHeight)
    x += barWidth + 1
  }
  ctx.fillText(`${fps}`, width-15, 10)
}

export class FreqViz extends React.Component<{store :AudioStore}> {

  canvasRef = React.createRef<HTMLCanvasElement>()
  lastFrameTime = 0
  onUnmount :Thunk = () => {}

  componentDidMount () {
    const canvas = this.canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext("2d")
      if (ctx) {
        var lastFrameTime = 0
        this.onUnmount = autorun(() => {
          const {time, frame} = this.props.store
          const frameDelta = time - lastFrameTime
          lastFrameTime = time
          renderHisto(ctx, frame, Math.round(1000/frameDelta))
        })
      }
    }
  }

  componentWillUnmount () {
    this.onUnmount()
  }

  render () {
    return (
      <div>
        <canvas ref={this.canvasRef} width={WIDTH} height={HEIGHT} />
      </div>
    )
  }
}

function renderGrid (ctx :CanvasRenderingContext2D, bheight :number) {
  const {width, height} = ctx.canvas
  ctx.fillStyle = "#FFFFFF"
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = "rgb(" + 0 + "," + 0 + "," + 0 + ")"
  for (let y = 0; y < height; y += bheight) {
    ctx.strokeRect(0, y, width, y+bheight)
  }
}

const MillisPerRow = 2000 // TODO: config

function renderEvents (ctx :CanvasRenderingContext2D, bheight :number, time :number,
                       events :Event[]) {
  const {width, height} = ctx.canvas
  const rows = Math.floor(height/bheight)

  let rowtime = Math.floor(time/MillisPerRow) * MillisPerRow
  let evidx = events.length-1
  for (let row = rows-1; row >= 0 && evidx >= 0; row -= 1, rowtime -= MillisPerRow) {
    let evy = row*bheight
    for ( ; evidx >= 0 && events[evidx].startTime >= rowtime; evidx -= 1) {
      let event = events[evidx]
      for (let ff = 0, fl = event.energies.length; ff < fl; ff += 1) {
        let fenergy = event.energies[ff]
        let ftime = event.times[ff]
        let evh = fenergy * bheight
        let evx = (ftime - rowtime) * width / MillisPerRow
        if (ff == 0) {
          ctx.fillStyle = "#F00"
          ctx.fillRect(evx, evy, 1, bheight-evh)
          ctx.fillStyle = "#00F"
        }
        ctx.fillRect(evx, evy+bheight-evh, 1, evh)
      }
    }
  }
}

export class EventViz extends React.Component<{store :AudioStore}> {

  canvasRef = React.createRef<HTMLCanvasElement>()
  onUnmount :Thunk = () => {}

  componentDidMount () {
    const canvas = this.canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext("2d")
      if (ctx) {
        const bheight = ctx.canvas.height/5
        this.onUnmount = autorun(() => {
          const {time, events} = this.props.store
          renderGrid(ctx, bheight)
          renderEvents(ctx, bheight, time, events)
        })
      }
    }
  }

  componentWillUnmount () {
    this.onUnmount()
  }

  render () {
    return (
      <div>
        <canvas ref={this.canvasRef} width={WIDTH} height={HEIGHT} />
      </div>
    )
  }
}
