import moment from "moment"

interface IWhen {
  kind: string
}

export interface IMoment extends IWhen {
  kind: "moment"
  moment: moment.Moment
}

interface INow extends IWhen {
  kind: "now"
}

export const Now: INow = {kind: "now"}

export interface IRelative extends IWhen {
  kind: "relative"
  count: number
  unit: moment.unitOfTime.Base
}

interface IInvalidDate extends IWhen {
  kind: "invalid"
}

export const InvalidDate: IInvalidDate = {kind: "invalid"}

export type When = IMoment | INow | IRelative | IInvalidDate

export enum Endpoint {
  Start = 0,
  End = 1,
}

export type Range = [When, When]

export class Time {
  static isRangeEqual(a: Range, b: Range): boolean {
    return JSON.stringify(a) === JSON.stringify(b)
  }

  static diff(a: When, b: When): moment.Duration {
    const start = Time.whenToMoment(a)
    const end = Time.whenToMoment(b)
    if (!start || !end) {
      return undefined
    }
    return moment.duration(end.diff(start))
  }

  // Shows something like 99y 11M 25d 7h 12m 30s.
  // Does not handle leap years very well.
  static getRangeHuman(d: moment.Duration, maxSignificantIntervals?: number): string {
    if (d == undefined) {
      return ""
    }

    let items = [
      ["years", "y"],
      ["months", "M"],
      ["days", "d"],
      ["hours", "h"],
      ["minutes", "m"],
      ["seconds", "s"],
      ["milliseconds", "ms"],
    ]
      .filter(c => d[c[0]]() > 0)
      .map(c => `${d[c[0]]()}${c[1]}`)

    if (maxSignificantIntervals !== undefined) {
      items = items.slice(0, maxSignificantIntervals)
    }

    return items.join(" ")
  }

  static wrapMovement(m: moment.Moment): When {
    return {
      kind: "moment",
      moment: m,
    }
  }

  static wrapDateRange(d: [Date, Date]): Range {
    return [
      this.wrapDate(d[0]),
      this.wrapDate(d[1]),
    ]
  }

  static wrapDate(d: Date): When {
    return {
      kind: "moment",
      moment: moment(d),
    }
  }

  static wrapRelative(count: number, unit: string): When {
    return {
      kind: "relative",
      count: count,
      unit: moment.normalizeUnits(unit),
    }
  }

  static whenToDate(when: When): Date | null {
    switch (when.kind) {
      case "now":
        return new Date()
      case "invalid":
        return null
      case "moment":
        return when.moment.toDate()
      case "relative":
        const amount = moment.duration(when.count, when.unit)
        return moment().add(amount).toDate()
      default:
        console.error("not a When type: ", when)
    }
  }

  static whenToMoment(when: When): moment.Moment | null {
    const d = Time.whenToDate(when)
    if (d == null) {
      return null
    }

    return moment(d)
  }

  static whenToComputed(when: When): string {
    const w = Time.whenToMoment(when)
    return w && w.toISOString(true) || ""
  }

  static whenToElastic(when: When): string | undefined {
    switch (when.kind) {
      case "now":
        return "now"
      case "invalid":
        return undefined
      case "moment":
        return when.moment.toISOString()
      case "relative":
        return `now${when.count}${when.unit.substring(0, 1)}`
      default:
        console.error("not a When type: ", when)
    }
  }

  static whenToText(when: When): string {
    switch (when.kind) {
      case "now":
        return ""
      case "invalid":
        return ""
      case "moment":
        return when.moment.toISOString()
      case "relative":
        return `${when.count}${when.unit.substring(0, 1)}`
      default:
        console.error("not a When type: ", when)
    }
  }

  static whenToDuration(when: When): moment.Duration {
    if (when.kind != "relative") {
      console.error(`${when.kind} not supported yet`)
      return undefined
    }

    return moment.duration(when.count, when.unit)
  }

  static whenAdd(when: When, duration: moment.Duration): When {
    return Time.wrapMovement(this.whenToMoment(when).add(duration))
  }

  static parseText(text: string): When {
    if (text === "") {
      return Now
    }

    // Only support negative deltas with an ES-ish format, e.g. "-1h", "now-10m" "-3 minutes"
    // https://www.elastic.co/guide/en/elasticsearch/client/net-api/current/date-math-expressions.html
    // TODO: It would be handy to support IS8601 deltas, e.g. "P1H30S", and human like, e.g. "-1h30s"
    // TODO: Also handy would be able to apply a diff to a full timestamp, e.g. "2011-11-11T12:34 +1h"
    const re = new RegExp(/^(now)?(-\d+) ?(\w)/).exec(text)
    if (re !== null) {
      return Time.wrapRelative(Number(re[2]), re[3])
    }

    // TODO: Fix the warning here:
    // Deprecation warning: value provided is not in a recognized RFC2822 or ISO format.
    // moment construction falls back to js Date(), which is not reliable across all browsers and versions.
    const m = moment(text)
    if (m.isValid()) {
      return Time.wrapMovement(m)
    }

    return InvalidDate
  }
}

