import { Lookup } from "./Lookup"

export class CopyHelper {
  private readonly textarea: HTMLTextAreaElement

  constructor() {
    try {
      this.textarea = Lookup.textarea("#copy-helper")
    } catch (e) {
      if (e.message.match("#copy-helper")) {
        // tslint:disable-next-line:no-console
        console.error("#copy-helper id not found in dom")
      } else {
        throw e
      }
    }
  }

  copy(s: string) {
    if (!this.textarea) {
      return
    }

    const oldFocus = document.activeElement as HTMLElement
    this.textarea.focus()
    this.textarea.value = s
    this.textarea.select()
    document.execCommand("copy")
    this.textarea.value = ""
    if (oldFocus && oldFocus.focus) {
      oldFocus.focus()
    }
  }
}
