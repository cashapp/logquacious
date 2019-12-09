import { Endpoint, Now, Range, Time, When } from "../helpers/time"
import { Filter, FilterType } from "../components/app"

export const DefaultPageSize = 200
const DefaultStartTime = Time.wrapRelative(-1, "h")
const DefaultEndTime = Now

// Query state data object with encoding/decoding to query parameters.
export class Query {
  terms?: string
  pageSize: number
  startTime: When
  endTime: When
  filters: Filter[]
  focusCursor?: string
  focusId?: string

  constructor() {
    // undefined means there hasn't been a search submitted yet
    this.terms = undefined
    this.pageSize = DefaultPageSize
    this.startTime = DefaultStartTime
    this.endTime = DefaultEndTime
    this.filters = []
    this.focusCursor = undefined
    this.focusId = undefined
  }

  clone(): Query {
    const q = new Query()
    q.terms = this.terms
    q.pageSize = this.pageSize
    q.startTime = this.startTime
    q.endTime = this.endTime
    q.filters = this.filters
    q.focusCursor = this.focusCursor
    q.focusId = this.focusId
    return q
  }

  equals(other: Query): boolean {
    return this.toURL() == other.toURL()
  }

  static fromURL(filters: Filter[], urlQuery?: string): Query {
    const result: any = {}
    urlQuery = urlQuery || window.location.search.substr(1)
    if (urlQuery != "") {
      urlQuery.split("&").forEach(function (part) {
        const item = part.split("=")
        if (item.length === 2) {
          result[item[0]] = decodeURIComponent(item[1].replace(/:/g, '%3A').replace(/\+/g, '%20'))
        }
      })
    }

    const q = new Query()
    q.terms = result["q"]
    q.pageSize = parseInt(result["n"]) || DefaultPageSize
    q.startTime = result["t"] ? Time.parseText(result["t"]) : DefaultStartTime
    q.endTime = result["u"] ? Time.parseText(result["u"]) : DefaultEndTime // u for until
    q.focusCursor = result["cursor"]
    q.focusId = result["id"]

    for (const idx in filters) {
      const filter = filters[idx]
      const selected = result[filter.urlKey] || filter.default
      q.filters[idx] = {...filter, selected}
    }

    return q
  }

  title(): string {
    if (this.terms && this.terms.trim() !== "") {
      return this.terms + " - Logquacious"
    }
    return "Logquacious"
  }

  isEmpty(): boolean {
    return this.terms == undefined
  }

  selectedDataSource(): string | undefined {
    if (!this.filters) {
      return undefined
    }

    const filter = this.filters.find(ds => ds.type == FilterType.dataSource)
    if (!filter) {
      return undefined
    }

    return filter.selected
  }

  toURL(): string {
    const values: { [id: string]: string } = {
      t: Time.whenToText(this.startTime),
    }
    if (this.terms != undefined) {
      values.q = this.terms
    }
    if (this.pageSize != DefaultPageSize) {
      values.n = String(this.pageSize)
    }
    if (this.endTime != DefaultEndTime) {
      values.u = Time.whenToMoment(this.endTime).toISOString()
    }
    if (this.focusCursor) {
      values.cursor = this.focusCursor
    }
    if (this.focusId) {
      values.id = this.focusId
    }
    for (const f of this.filters) {
      values[f.urlKey] = f.selected || ""
    }

    return Object.keys(values)
    // Space can be encoded as +, and : can be left alone. encodeURIComponent is a bit overly aggressive
    // to be support poor URI standards.
      .map(k =>
        encodeURIComponent(k) + '=' +
        encodeURIComponent(values[k])
          .replace(/%20/g, '+')
          .replace(/%3A/g, ':')
      )
      .join('&')
  }

  withNewTerms(terms: string): Query {
    const q = this.clone()
    q.terms = terms
    return q
  }

  withTerm(term: string): Query {
    const q = this.clone()
    q.terms = this.terms ? this.terms + ' ' + term : term
    return q
  }

  withPageSize(pageSize: number): Query {
    const q = this.clone()
    q.pageSize = pageSize
    return q
  }

  withTimeRange(range: Range): Query {
    const q = this.clone()
    q.startTime = range[Endpoint.Start]
    q.endTime = range[Endpoint.End]
    return q
  }

  // Solidify the search time range so they are absolute/constant time values. Good for sharing links.
  withFixedTimeRange(): Query {
    const q = this.clone()
    q.startTime = Time.parseText(Time.whenToComputed(q.startTime))
    q.endTime = Time.parseText(Time.whenToComputed(q.endTime))
    return q
  }

  withAppendFilter(filter: string, selected: string): Query {
    const q = this.clone()
    q.filters = this.filters.map(f => f.id == filter ? {...f, selected} : f)
    return q
  }

  withFocus(id?: string, cursor?: string): Query {
    const q = this.clone()
    q.focusId = id
    q.focusCursor = cursor
    return q
  }
}

