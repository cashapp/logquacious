import { Lookup } from "../helpers/lookup"

export class Loading {
  private depth: number = 0
  private elm: HTMLProgressElement
  cls = "is-info"

  constructor() {
    this.elm = Lookup.element('#loading')
    this.deactivate()
  }

  activate() {
    this.depth++
    this.elm.classList.remove("is-hidden")
    this.elm.classList.add(this.cls)
  }

  deactivate() {
    this.depth--
    if (this.depth <= 0) {
      this.depth = 0
      this.elm.classList.add("is-hidden")
    }
  }
}
