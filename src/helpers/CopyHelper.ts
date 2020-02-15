import { Lookup } from "./Lookup"

export class CopyHelper {
    private textarea: HTMLTextAreaElement

    constructor() {
        this.textarea = Lookup.textarea("#copy-helper")
    }

    copy(s: string) {
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
