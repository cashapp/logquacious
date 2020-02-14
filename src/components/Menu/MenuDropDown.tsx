import { Component } from "inferno"

interface Props {
  title: string
  // isActive gives you the option for automatic hovering, or the caller to control the active state.
  isActive: "auto" | boolean
  onMouseEnter?: EventHandlerNonNull
  onMouseLeave?: EventHandlerNonNull
  extraItemClass?: string
  extraLinkClass?: string
  extraDropdownClass?: string
}

export class MenuDropdown extends Component<Props> {
  activeClass() {
    switch (this.props.isActive) {
      case "auto":
        return "is-hoverable"
      case true:
        return "is-active"
      case false:
        return ""
    }
  }

  render() {
    const itemActive = this.activeClass()

    return (
      <div
        class={`navbar-item has-dropdown ${itemActive} ${this.props.extraItemClass || ""}`}
        onmouseenter={this.props.onMouseEnter}
        onmouseleave={this.props.onMouseLeave}
      >
        <a class={`navbar-link ${this.props.extraLinkClass || ""}`}>{this.props.title}</a>
        <div class={`navbar-dropdown is-right ${this.props.extraDropdownClass || ""}`}>
          {this.props.children}
        </div>
      </div>
    )
  }
}