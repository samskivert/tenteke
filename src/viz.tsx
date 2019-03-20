import * as React from "react";
import { observer } from "mobx-react"
import { AudioStore } from "./store"

const WIDTH = 290
const HEIGHT = 145

function renderHisto (ctx :CanvasRenderingContext2D, data :Uint8Array, fps :number) {
  const buckets = data.length
  const barWidth = (WIDTH / buckets)-1
  let x = 0, barHeight = 0
  ctx.fillStyle = "#000"
  ctx.fillRect(0, 0, WIDTH, HEIGHT)
  const heightScale = HEIGHT / 256
  for (var ii = 0; ii < buckets; ii++) {
    barHeight = data[ii] * heightScale
    var r = data[ii] + (25 * (ii/buckets))
    var g = 250 * (ii/buckets)
    var b = 50
    ctx.fillStyle = "rgb(" + r + "," + g + "," + b + ")"
    ctx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight)
    x += barWidth + 1
  }
  ctx.fillText(`${fps}`, WIDTH-15, 10)
}

var testNo = 0

@observer
export class SigList extends React.Component<{store :AudioStore}> {

  render () {
    const {store} = this.props
    const sigs = (store.sigs.length == 0) ? <div>No sigs.</div> :
      <ul>{store.sigs.map(sig => <li key={sig.name}>{sig.name}</li>)}</ul>

    return (
      <div>
        {sigs}
        <button onClick={ev => {
          testNo += 1 ; store.recordSig(`Test ${testNo}`)}
        }>Add strike</button>
      </div>)
  }
}

export class AudioViz extends React.Component<{store :AudioStore}> {

  canvasRef = React.createRef<HTMLCanvasElement>()

  componentDidMount() {
    const canvas = this.canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.fillStyle = "rgb(128, 128, 128)"
        ctx.fillRect(0, 0, WIDTH, HEIGHT)
        ctx.fillStyle = "rgb(128, 128, 256)"
        ctx.fillRect(WIDTH/4, HEIGHT/4, WIDTH/2, HEIGHT/2)

        var lastFrameTime = 0
        this.props.store.start((time, frame) => {
          const frameDelta = time - lastFrameTime
          lastFrameTime = time
          renderHisto(ctx, frame, Math.round(1000/frameDelta))
        })
      }
    }
  }

  render () {
    return (
      <div>
        <canvas ref={this.canvasRef} width={WIDTH} height={HEIGHT} />
      </div>
    )
  }
}
