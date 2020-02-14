import { Component, Fragment } from "inferno"

interface Props {
  id: string
  name: string
  onChange: (e: Event) => void
  checked: boolean
}

export class MenuRadio extends Component<Props> {
  render() {
    return (
      <Fragment>
        <input
          onChange={this.props.onChange}
          class=" is-checkradio is-info"
          id={this.props.id}
          type="radio"
          name={this.props.name}
          checked={this.props.checked}
        />
        <label htmlFor={this.props.id}>{this.props.children}</label>
      </Fragment>
    )
  }
}