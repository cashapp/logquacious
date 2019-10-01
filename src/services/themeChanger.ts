import { Lookup } from "../helpers/lookup"
import { Theme } from "./prefs"

export class ThemeChanger {
  private theme: Theme

  setTheme(theme: Theme) {
    const prevTheme = this.theme
    this.theme = theme

    const el = Lookup.element("html")
    el.classList.remove(prevTheme + "-theme")
    el.classList.add(this.theme + "-theme")
  }
}