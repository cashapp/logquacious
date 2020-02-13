import { Endpoint, Now, Range, Time, When } from "../helpers/Time"
import { Filter, FilterEnableRule, FilterType } from "../components/App"

export const DefaultPageSize = 200
const DefaultStartTime = Time.wrapRelative(-1, "h")
const DefaultEndTime = Now

export type LoadOptions = {
  urlQuery?: string
  storage?: Storage
}

const storageKey = "query"

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

  static splitURL(s: string): string {
    const parts = s.split(/\?(.*)/)
    if (parts.length == 1) {
      return parts[0]
    } else {
      return parts[1]
    }
  }

  static load(filters: Filter[], options: LoadOptions = {}): Query {
    const result: any = {}
    let urlQuery = options.urlQuery || window.location.search
    urlQuery = this.splitURL(urlQuery)
    if (urlQuery != "") {
      urlQuery.split("&").forEach(function (part) {
        const item = part.split("=")
        if (item.length === 2) {
          result[item[0]] = decodeURIComponent(item[1].replace(/:/g, '%3A').replace(/\+/g, '%20'))
        }
      })
    }

    const q = new Query()
    q.terms = result.q
    q.pageSize = parseInt(result.n) || DefaultPageSize
    q.startTime = result.t ? Time.parseText(result.t) : DefaultStartTime
    q.endTime = result.u ? Time.parseText(result.u) : DefaultEndTime // u for until
    q.focusCursor = result.cursor
    q.focusId = result.id

    let storageFilters: Map<string, string> = new Map<string, string>()
    if (options.storage) {
      storageFilters = this.loadStorage(options.storage)
    }

    for (const idx in filters) {
      const filter = filters[idx]
      const emptyItem = filter.items.find(i => i.id == "")
      const undefinedItem = filter.items.find(i => i.id == undefined)

      let selected = result[filter.urlKey]
      if (selected == undefined) {
        selected = storageFilters.get(filter.urlKey)
        if (selected == undefined) {
          selected = filter.default
        }
      } else if (selected == "") {
        if (emptyItem) {
          selected = ""
        } else if (undefinedItem) {
          selected = undefined
        }
      }
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
    const values: { [id: string]: string | undefined } = {}
    if (this.terms != undefined) {
      values.q = this.terms
    }
    if (this.pageSize != DefaultPageSize) {
      values.n = String(this.pageSize)
    }
    if (this.startTime != DefaultStartTime) {
      values.t = Time.whenToMoment(this.startTime).toISOString()
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

  withAddTerms(term: string): Query {
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

  // Load certain filter defaults from localStorage.
  static loadStorage(storage: Storage): Map<string, string> {
    const raw = storage.getItem(storageKey)
    if (!raw) {
      return new Map<string, string>()
    }
    return new Map(Object.entries(JSON.parse(raw)))
  }

  toStorage(storage: Storage) {
    const data = this.filters
      .filter(f => f.remember)
      .filter(f => f.selected != undefined)
      .reduce((d, f) => {
        d[f.urlKey] = f.selected
        return d
      }, {})

    storage.setItem(storageKey, JSON.stringify(data))
    return this
  }

  enabledFilters(): Filter[] {
    return this.filters.filter(f => {
      if (!f.enabled) {
        return true
      }

      return f.enabled.find(rule => {
        // We only have one kind, which is a filter rule.
        rule = rule as FilterEnableRule
        const foundFilter = this.filters.find(ff => ff.id == rule.id)
        if (!foundFilter) {
          throw new Error(`enabled rule ${rule} is referencing an unknown filter: ${rule.id}`)
        }

        let values: (string | undefined)[]
        if (typeof rule.value == "string") {
          values = [rule.value]
        } else if (rule.value == undefined) {
          values = [undefined]
        } else {
          values = rule.value
        }

        return values.find(v => foundFilter.selected == v)
      })
    })
  }
}

