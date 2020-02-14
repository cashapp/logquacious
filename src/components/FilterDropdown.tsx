import { Component } from "inferno"
import { FilterGroup } from "./FilterGroup"
import { Filter } from "./App"
import { MenuDropdown } from "./Menu/MenuDropDown"

export type ChangeFilterCallback = (filter: string, item: string) => void

export type FilterItem = {
  id: string
  title: string
  shortTitle?: string
  terms?: string
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
      const selectedItem = f.items.find(i => i.id === f.selected)
      return selectedItem && (selectedItem.shortTitle || selectedItem.title) || ""
    })
      .filter(f => f !== "")
      .join(", ")

    return (
      <MenuDropdown title={active} isActive="auto">
        {items}
      </MenuDropdown>
    )
  }
}
