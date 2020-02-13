import { Component, Fragment } from "inferno"
import { Menu } from "./menu"
import { Filter } from "./app"
import { ChangeFilterCallback } from "./filterDropdown"

type Props = {
  onChange: ChangeFilterCallback
  filter: Filter
}

export class FilterGroup extends Component<Props> {
  onChange = e => this.props.onChange(this.props.filter.id, e.target.name)

  render() {
    const filter = this.props.filter
    const items = filter.items.map(item => {
      const id = `${filter.id}-${item.id}`
      const checked = (filter.selected === item.id) || (!filter.selected && !item.id)
      return (
        <Menu.Radio id={id} name={item.id} onChange={this.onChange} checked={checked}>{item.title}</Menu.Radio>
      )
    })

    return (
      <Fragment>
        <Menu.Title>{filter.title}</Menu.Title>
        <Menu.Item>
          <Menu.Field>
            {items}
          </Menu.Field>
        </Menu.Item>
        <Menu.Divider/>
      </Fragment>
    )
  }
}

