import * as React from "react";
// import * as ReactDOM from "react-dom";

const WIDTH = 290
const HEIGHT = 145

function renderHisto (ctx :CanvasRenderingContext2D, data :Uint8Array) {
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
}

export class AudioViz extends React.Component {

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

        var actx = new AudioContext()
        navigator.mediaDevices.getUserMedia({ audio: true, video: false }).then(stream => {
          var source = actx.createMediaStreamSource(stream)
          var analyser = actx.createAnalyser()
          analyser.smoothingTimeConstant = 0.1
          source.connect(analyser)
          // analyser.connect(actx.destination)
          analyser.fftSize = 32
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const renderFrame = () => {
            requestAnimationFrame(renderFrame)
            analyser.getByteFrequencyData(dataArray)
            renderHisto(ctx, dataArray)
          }
          requestAnimationFrame(renderFrame)
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
