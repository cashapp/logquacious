export class Lookup {
  static element<E extends Element = Element>(selector: string): E {
    const elm = <E>document.querySelector(selector);
    if (elm === null) {
      console.error('Could not find element', selector)
    }
    return elm
  }

  static button(selector: string): HTMLButtonElement {
    return Lookup.element<HTMLButtonElement>(selector)
  }

  static input(selector: string): HTMLInputElement {
    return Lookup.element<HTMLInputElement>(selector)
  }

  static textarea(selector: string): HTMLTextAreaElement {
    return Lookup.element<HTMLTextAreaElement>(selector)
  }
}