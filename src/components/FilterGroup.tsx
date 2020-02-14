import { Component, Fragment } from "inferno"
import { Filter } from "./App"
import { ChangeFilterCallback } from "./FilterDropdown"
import { MenuField } from "./Menu/MenuField"
import { MenuItem } from "./Menu/MenuItem"
import { MenuTitle } from "./Menu/MenuTitle"
import { MenuDivider } from "./Menu/MenuDivider"
import { MenuRadio } from "./Menu/MenuRadio"

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

