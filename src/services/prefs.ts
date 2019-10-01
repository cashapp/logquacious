export enum Direction {
  Up = 'up',
  Down = 'down',
}

export function SwapDirection(d: Direction) {
  return (d == Direction.Up) ? Direction.Down : Direction.Up
}

export enum Theme {
  Light = 'light',
  Dark = 'dark',
}

interface IPrefs {
  direction: Direction,
  theme: Theme,
}

export class Prefs {
  data: IPrefs

  private readonly defaultSettings: IPrefs = {
    direction: Direction.Up,
    theme: Theme.Dark,
  }

  set theme(theme: Theme) {
    this.data.theme = theme
    this.save()
  }

  get theme() {
    return this.data.theme
  }

  set direction(direction: Direction) {
    this.data.direction = direction
    this.save()
  }

  get direction() {
    return this.data.direction
  }

  save() {
    localStorage.settings = JSON.stringify(this.data)
  }

  load(): Prefs {
    const blob = localStorage.settings || "{}"
    this.data = JSON.parse(blob)
    this.applyDefaults()
    this.save()
    return this
  }

  applyDefaults() {
    const s = this.data
    for (const key in this.defaultSettings) {
      s[key] = (s[key] === undefined) ? this.defaultSettings[key] : s[key]
    }
  }
}

