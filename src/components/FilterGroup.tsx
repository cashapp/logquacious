import { Component, Fragment } from "inferno"
import { Filter } from "./App"
import { ChangeFilterCallback } from "./FilterDropdown"
import { MenuField } from "./menu/MenuField"
import { MenuItem } from "./menu/MenuItem"
import { MenuTitle } from "./menu/MenuTitle"
import { MenuDivider } from "./menu/MenuDivider"
import { MenuRadio } from "./menu/MenuRadio"

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
        <MenuRadio id={id} name={item.id} onChange={this.onChange} checked={checked}>{item.title}</MenuRadio>
      )
    })

    return (
      <Fragment>
        <MenuTitle>{filter.title}</MenuTitle>
        <MenuItem>
          <MenuField>
            {items}
          </MenuField>
        </MenuItem>
        <MenuDivider/>
      </Fragment>
    )
  }
}

