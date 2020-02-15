import { Component, Fragment } from "inferno"

export type AttachHistogramCallback = (el: SVGElement) => void

interface Props {
  onAttachHistogram: AttachHistogramCallback
}

export class Histogram extends Component<Props> {
  saveRef = (el: SVGElement) => {
    this.props.onAttachHistogram(el)
  }

  render() {
    return (
      <Fragment>
        <div id="histogram-tooltip"/>
        <div id="histogram">
          <svg ref={this.saveRef}/>
        </div>
      </Fragment>
    )
  }
}