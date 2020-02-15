import { Lookup } from "../helpers/Lookup"
import { Theme } from "./Prefs"

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