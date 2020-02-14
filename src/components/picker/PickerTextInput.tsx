import { Component } from "inferno"
import { Time } from "../../helpers/Time"
import { InputInfo } from "./Picker"

interface Props {
  value: InputInfo
  title: string
  placeholder: string
  onChange: EventHandlerNonNull
  onKeyPress: EventHandlerNonNull
}

export class PickerTextInput extends Component<Props> {
  private timer

  componentDidMount(): void {
    this.timer = setInterval(this.needsUpdate, 1000)
  }

  componentWillUnmount(): void {
    clearInterval(this.timer)
    this.timer = undefined
  }

  needsUpdate = () => {
    this.forceUpdate()
  }

  render() {
    return (
      <div class="field">
        <div class="is-pulled-right">
          <span>{Time.whenToComputed(this.props.value.when)}</span>
        </div>
        <label class="label">{this.props.title}</label>
        <div class="control">
          <input
            class={`input ${this.props.value.isValid ? "" : "is-danger"}`}
            type="text"
            placeholder={this.props.placeholder}
            value={this.props.value.text}
            onInput={this.props.onChange}
            onkeypress={this.props.onKeyPress}
          />
        </div>
      </div>
    )
  }
}