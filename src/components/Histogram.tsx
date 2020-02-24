import { Component } from "inferno"

export type AttachHistogramCallback = (el: SVGElement) => void

interface Props {
  visible: boolean
  onAttachHistogram: AttachHistogramCallback
}

export class Histogram extends Component<Props> {
  saveRef = (el: SVGElement) => {
    this.props.onAttachHistogram(el)
  }

  render() {
    const visibility = this.props.visible ? "visible" : "hidden"

    return (
      <div style={{visibility}}>
        <div id="histogram-tooltip"/>
        <div id="histogram">
          <svg ref={this.saveRef}/>
        </div>
      </div>
    )
  }
}