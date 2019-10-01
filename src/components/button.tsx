import { Component, InfernoNode } from "inferno"

interface Props {
  active?: boolean
  onClick: EventHandlerNonNull
  children: InfernoNode
}

export class Button extends Component<Props> {
  render() {
    let {active, onClick, children} = this.props
    if (active === true || active === undefined) {
      return <button class="button" onclick={onClick}>{children}</button>
    } else {
      return <button class="button" disabled={true}>{children}</button>
    }
  }
}