import { Component, Fragment } from "inferno"

export namespace Menu {
  export const Field = ({children}) => <div class="field">{children}</div>
  export const Item = ({children, id = "", extraClass = ""}) => <a id={id} class={`navbar-item ${extraClass}`}>{children}</a>
  export const Title = ({children}) => <Item><b>{children}</b></Item>
  export const Divider = () => <hr class="navbar-divider"/>

  interface DropdownProps {
    title: string
    // isActive gives you the option for automatic hovering, or the caller to control the active state.
    isActive: "auto" | boolean
    onMouseEnter?: EventHandlerNonNull
    onMouseLeave?: EventHandlerNonNull
    extraItemClass?: string
    extraLinkClass?: string
    extraDropdownClass?: string
  }

  export class Dropdown extends Component<DropdownProps> {
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

  interface CheckboxProps {
    id: string
    onChange: (e: Event) => void
    checked: boolean
  }

  export class Checkbox extends Component<CheckboxProps> {
    render() {
      return (
        <Item>
          <input onChange={this.props.onChange} id={this.props.id} type="checkbox" class="switch is-info" checked={this.props.checked}/>
          <label htmlFor={this.props.id}>{this.props.children}</label>
        </Item>
      )
    }
  }

  interface RadioProps {
    id: string
    name: string
    onChange: (e: Event) => void
    checked: boolean
  }

  export class Radio extends Component<RadioProps> {
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
}