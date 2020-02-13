import { Component, Fragment } from "inferno"
import { Menu } from "./menu"

export type ChangeSettingCallback<T> = (value: T) => void

interface Props<T> {
  onChange: ChangeSettingCallback<T>
  setting: string
  title: string
  value: T
  on: Option<T>
  off: Option<T>
}

interface Option<T> {
  value: T
  title: string
}

export class MenuSetting<T> extends Component<Props<T>, any> {
  onChange = e => this.props.onChange(e.target.checked ? this.props.on.value : this.props.off.value)

  render() {
    const checked = this.props.value === this.props.on.value
    const info = checked ? this.props.on : this.props.off
    const title = <Fragment>{this.props.title}: <b>{info.title}</b></Fragment>
    return (
      <Menu.Checkbox id={this.props.setting} onChange={this.onChange} checked={checked}>{title}</Menu.Checkbox>
    )
  }
}
