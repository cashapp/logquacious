import { Endpoint, Now, Time, When } from "../helpers/time"
import { Filter, FilterType } from "../components/app"

export const DefaultPageSize = 200
const DefaultStartTime = Time.wrapRelative(-1, "h")

// Query state data object with encoding/decoding to query parameters.
export class Query {
  q: string
  pageSize: number
  startTime: When
  endTime: When
  filters: Filter[]

  constructor(q: string, pageSize: number, startTime: When, endTime: When, filters: Filter[]) {
    this.q = q
    this.pageSize = pageSize
    this.filters = filters || []
    this.startTime = startTime
    this.endTime = endTime
  }

  static Default(): Query {
    return new Query("", DefaultPageSize, DefaultStartTime, Now, [])
  }

  static fromURL(filters: Filter[]): Query {
    const result: any = {}
    const query = window.location.search.substr(1)
    if (query != "") {
      query.split("&").forEach(function (part) {
        const item = part.split("=")
        if (item.length === 2) {
          result[item[0]] = decodeURIComponent(item[1].replace(/:/g, '%3A').replace(/\+/g, '%20'))
        }
      })
    }
    let q: string = result["q"] || ""
    let pageSize: number = result["n"] || DefaultPageSize
    let startTime: When = result["t"] ? Time.parseText(result["t"]) : DefaultStartTime
    let endTime: When = result["u"] ? Time.parseText(result["u"]) : Now // u for until

    for (const idx in filters) {
      const filter = filters[idx]
      const selected = result[filter.urlKey] || filter.default
      filters[idx] = {...filter, selected}
    }

    return new Query(q, pageSize, startTime, endTime, filters)
  }

  equals(other: Query): boolean {
    return this.q == other.q &&
      this.pageSize == other.pageSize &&
      this.startTime == other.startTime &&
      this.endTime == other.endTime &&
      (this.filters.every(f => f.selected == other.filters.find(ff => ff.id == f.id).selected))
  }

  title(): string {
    if (this.q && this.q.trim() !== "") {
      return this.q + " - Logquacious"
    }
    return "Logquacious"
  }

  isEmpty(): boolean {
    return this.q == ""
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
      q: this.q,
      t: Time.whenToText(this.startTime),
    }
    if (this.pageSize != DefaultPageSize) {
      values.n = String(this.pageSize)
    }
    if (this.endTime != Now) {
      values.u = Time.whenToText(this.endTime)
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

  replaceText(text: string): Query {
    return new Query(
      text,
      this.pageSize,
      this.startTime,
      this.endTime,
      this.filters,
    )
  }

  withTerm(term: string): Query {
    return this.replaceText(this.q ? this.q + ' ' + term : term)
  }

  withTimeRange(range): Query {
    return new Query(
      this.q,
      this.pageSize,
      range[Endpoint.Start],
      range[Endpoint.End],
      this.filters,
    )
  }

  withFilter(filter: string, selected: string) {
    const filters = this.filters.map(f => f.id == filter ? {...f, selected} : f)
    return new Query(
      this.q,
      this.pageSize,
      this.startTime,
      this.endTime,
      filters,
    )
  }
}

