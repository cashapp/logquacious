import { Component } from "inferno"
import { FilterGroup } from "./filterGroup"
import { Menu } from "./menu"
import { Filter } from "./app"

export type ChangeFilterCallback = (filter: string, item: string) => void

export type FilterItem = {
  id: string
  title: string
  shortTitle?: string
}

type Props = {
  onChange: ChangeFilterCallback
  filters: Filter[]
}

export class FilterDropdown extends Component<Props> {
  render() {
    if (!this.props.filters) {
      return null
    }

    const items = this.props.filters.map(f => <FilterGroup onChange={this.props.onChange} filter={f}/>)
    const active = this.props.filters
      .map(f => {
      const selectedItem = f.items.find(i => i.id == f.selected)
      return selectedItem && (selectedItem.shortTitle || selectedItem.title) || ""
    })
      .filter(f => f != "")
      .join(", ")

    return (
      <Menu.Dropdown title={active} isActive="auto">
        {items}
      </Menu.Dropdown>
    )
  }
}
