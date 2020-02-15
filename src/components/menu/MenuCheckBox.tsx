import { Component } from "inferno"
import { MenuItem } from "./MenuItem"

interface Props {
  id: string
  onChange: (e: Event) => void
  checked: boolean
}

export class MenuCheckBox extends Component<Props> {
  render() {
    return (
      <MenuItem>
        <input onChange={this.props.onChange} id={this.props.id} type="checkbox" class="switch is-info" checked={this.props.checked}/>
        <label htmlFor={this.props.id}>{this.props.children}</label>
      </MenuItem>
    )
  }
}