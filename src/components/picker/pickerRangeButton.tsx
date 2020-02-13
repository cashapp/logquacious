import { Component } from "inferno"
import { Endpoint, Now, Time, When, Range } from "../../helpers/Time"

export type ClickNewRangeHandler = (delta: When) => void

interface Props {
  delta: string
  range: Range
  onClick: ClickNewRangeHandler
}

export class PickerRangeButton extends Component<Props> {
  toWhen = () => Time.parseText("-" + this.props.delta)

  handleClick = () => {
    this.props.onClick(this.toWhen())
  }

  render() {
    const whenStr = JSON.stringify(Time.parseText("-" + this.props.delta))
    const selected = JSON.stringify(this.props.range[Endpoint.Start]) == whenStr && this.props.range[Endpoint.End] == Now
    return (
      <button class={`button ${selected ? "is-info" : ""}`} onclick={this.handleClick}>{this.props.delta}</button>
    )
  }
}