export enum Direction {
  Up = 'up',
  Down = 'down',
}

export function SwapDirection(d: Direction) {
  return (d === Direction.Up) ? Direction.Down : Direction.Up
}

export enum Theme {
  Light = 'light',
  Dark = 'dark',
}

export enum TimeZone {
  Local = 'local',
  UTC = 'utc',
}

interface IPrefs {
  direction: Direction,
  theme: Theme,
  tz: TimeZone,
}

export class Prefs {
  data: IPrefs

  private readonly defaultSettings: IPrefs = {
    direction: Direction.Up,
    theme: Theme.Dark,
    tz: TimeZone.Local,
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

  set tz(tz: TimeZone) {
    this.data.tz = tz
    this.save()
  }

  get tz() {
    return this.data.tz
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
    for (const key of Object.keys(this.defaultSettings)) {
      s[key] = (s[key] === undefined) ? this.defaultSettings[key] : s[key]
    }
  }
}

