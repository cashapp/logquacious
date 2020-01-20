import { IRelative, Time, When } from "../helpers/time"
import { Query } from "../services/query"
import { FilterType } from "../components/app"
import { FieldsConfig } from "../services/log"

class ElasticsearchException implements Error {
  constructor(name: string, s: string) {
    this.name = name
    this.message = s
  }

  message: string
  name: string
}

// Result of a search.
export interface Result {
  // Logs with the minimum fields required for display in the listing.
  overview: Array<LogMessage>
  // The full set of log fields. This is asynchronously loaded.
  full: Promise<Map<string, LogMessage>[]>
}

// Result of a histogram from ES
interface ElasticsearchHistogramResponse {
  aggregations: {
    // n is specified in the query as the name of the aggregation
    n: {
      buckets: ElasticsearchHistogramBucket[],
    }
  }
}

interface ElasticsearchHistogramBucket {
  key_as_string: string,
  doc_count: number,
}

// Histogram results to give to the caller
export interface HistogramResults {
  buckets: Bucket[]
}

export interface Bucket {
  when: When
  count: number
}

interface LogMessages {
  docs: LogMessage[]
}

export interface LogMessage {
  // If present will eventually contain the full log message.
  _full?: Promise<LogMessage>
  _id?: string
  _index?: string
  _type?: string

  [key: string]: any
}

interface ElasticsearchError {
  error: any
}

interface SortItem {
  [key: string]: { order: "asc" | "desc" }
}

interface SearchQuery {
  query: any
  aggs?: any
  docvalue_fields?: { field: string; format: string }[]
  _source?: string[]
  search_after?: Cursor
  sort?: SortItem[]
  size?: number
  timeout?: string
}

interface ElasticsearchHits {
  hits: Array<LogMessage>
}

interface ElasticsearchResults {
  _shards: any
  hits: ElasticsearchHits
  timed_out: boolean
  took: number
}

export type Cursor = (number | string)[]

type Index = string
type Type = string
type IdOrLogMsg = string | LogMessage

type TypeIds = Map<Type, Array<IdOrLogMsg>>

type IndexTypeIds = Map<Index, TypeIds>

export interface IDataSource {
  historicSearch(query: Query, cursor?: Cursor, searchAfterAscending?: boolean): Promise<Result>

  surroundSearch(query: Query, cursor: Cursor, searchAfterAscending?: boolean): Promise<Result>

  histogram(query: Query, interval: IRelative, tz: string): Promise<HistogramResults>
}

/**
 * Manages search queries to Elasticsearch.
 */
export class Elasticsearch implements IDataSource {
  private readonly urlPrefix: string
  private readonly index: string
  private fieldsConfig: FieldsConfig

  constructor(urlPrefix: string, index: string, fieldsConfig: FieldsConfig) {
    this.urlPrefix = urlPrefix
    this.index = index
    this.fieldsConfig = fieldsConfig
  }

  url(suffix: string, index: string): string {
    return `${this.urlPrefix}/${index}/${suffix}`
  }

  static async fetch<T>(url, method = "POST", body?: object): Promise<T> {
    let request: RequestInit = {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    }

    if (body !== undefined) {
      request.body = JSON.stringify(body)
    }

    let resp
    try {
      resp = await fetch(url, request)
    } catch (e) {
      throw new ElasticsearchException(`Failed Elasticsearch request at ${url}`, e)
    }

    let response: T | ElasticsearchError
    try {
      response = await resp.json()
    } catch (e) {
      throw new ElasticsearchException("Could not decode JSON", e)
    }

    if ((response as ElasticsearchError).error !== undefined) {
      throw new ElasticsearchException("Error in Elasticsearch response", JSON.stringify(response, null, 4))
    }

    return response as T
  }

  // Load a single document.
  async loadDocument(index: string, type: string, id: string): Promise<LogMessage> {
    const url = this.url(`${type}/${id}`, index)
    const data = await Elasticsearch.fetch<LogMessage>(url, "GET")
    return this.normaliseLog(data)
  }

  async historicSearch(query: Query, cursor?: Cursor, searchAfterAscending?: boolean): Promise<Result> {
    let search = this.historicRequest(query)
    search.sort = [
      {
        [this.fieldsConfig.timestamp]: {
          order: (searchAfterAscending === true) ? 'asc' : 'desc'
        }
      },
    ]

    if (cursor !== undefined) {
      search.search_after = cursor
    }

    const url = this.url(`_search`, this.index)
    const data = await Elasticsearch.fetch<ElasticsearchResults>(url, "POST", search)
    if (data._shards && data._shards.failed) {
      throw new ElasticsearchException("Shard failure", JSON.stringify(data._shards.failures[0], null, 2))
    }

    if (data.hits === undefined || !data.hits.hits) {
      return null
    }

    let hits = data.hits.hits.map(r => this.normaliseLog(r))

    // We retrieve the data in descending order, but the app expects it to be in ascending order.
    if (searchAfterAscending !== true) {
      hits.reverse()
    }

    // Shard request by index and doc type.
    let idsByIndex: IndexTypeIds = new Map<Index, TypeIds>()
    hits.forEach(hit => {
      idsByIndex.set(hit._index, idsByIndex.get(hit._index) || new Map<Type, IdOrLogMsg[]>())
      idsByIndex.get(hit._index).set(hit._type, idsByIndex.get(hit._index).get(hit._type) || [])
      idsByIndex.get(hit._index).get(hit._type).push(hit._id)
    })

    const full = this.injectFinalPromise(hits, idsByIndex)
    return {overview: hits, full: full}
  }

  async surroundSearch(query: Query, cursor?: Cursor, searchAfterAscending?: boolean): Promise<Result> {
    // 1) Search up by half the query limit size, get the first item, then discard the whole set
    // 2) Search down from the first result to the full query size
    // That should make the focused document in the middle of the results
    const backQuery = query.withPageSize(query.pageSize / 2 + 1)
    const backResults = await this.historicSearch(backQuery, cursor, !searchAfterAscending)
    if (backResults.overview.length == 0) {
      return Promise.resolve(backResults)
    }
    const backCursor = backResults.overview[0].__cursor
    return this.historicSearch(query, backCursor, searchAfterAscending)
  }

  private historicRequest(query: Query): SearchQuery {
    let stringQuery: any
    if (query.terms) {
      stringQuery = {
        query_string: {
          analyze_wildcard: true,
          default_field: 'message',
          default_operator: 'AND',
          fuzziness: 0,
          query: query.terms,
        }
      }
    } else {
      stringQuery = {
        match_all: {}
      }
    }
    const timeQuery = {
      range: {
        [this.fieldsConfig.timestamp]: {
          format: 'strict_date_optional_time',
          gte: Time.whenToElastic(query.startTime),
          lte: Time.whenToElastic(query.endTime),
        }
      }
    }

    const filterQuery = []
    for (const filter of query.filters) {
      // TODO: Work out why this is sometimes an empty string instead of undefined
      if (filter.selected == undefined || filter.selected == "") {
        continue
      }

      // TODO: Allow for range and multiple values
      switch (filter.type) {
        case FilterType.singleValue: {
          const must = {term: {}}
          must.term[filter.id] = {
            value: filter.selected,
          }
          filterQuery.push(must)
          break
        }
      }
    }

    return {
      // Select specific fields from logs. This list must contain all fields used in rules for log formatting
      _source: this.collapsedFields(),
      docvalue_fields: [
        {
          field: this.fieldsConfig.timestamp,
          format: 'date_time'
        }
      ],
      query: {
        bool: {
          must: [
            stringQuery,
            timeQuery,
            ...filterQuery,
          ]
        }
      },
      size: query.pageSize,
      timeout: '30000ms'
    }
  }

  // Inject "_full" field into hits from async _mget.
  private injectFinalPromise(hits: Array<LogMessage>, indexes: IndexTypeIds): Promise<Map<string, LogMessage>[]> {
    if (hits.length === 0) {
      return Promise.resolve([])
    }
    const allPromises = []
    indexes.forEach((typeIds, index) => {
      typeIds.forEach((ids, type) => {
        const bulkGetPromise = this.bulkGet(index, type, ids as string[])
        allPromises.push(bulkGetPromise)
        hits
          .filter(hit => hit._index == index)
          .filter(hit => hit._type == type)
          .forEach(hit => hit._full = new Promise<LogMessage>(resolve => {
            bulkGetPromise.then(logMsgs => resolve(logMsgs.get(hit._id)))
          }))
      })
    })

    return Promise.all(allPromises)
  }

  // Bulk get a set of documents.
  async bulkGet(index: string, type: string, ids: Array<string>): Promise<Map<string, LogMessage>> {
    const url = this.url(`${type}/_mget`, index)
    let request = {docs: ids.map(id => ({_id: id}))}
    const data = await Elasticsearch.fetch<LogMessages>(url, "POST", request)
    return new Map<string, LogMessage>(data.docs.map((doc: LogMessage) => [doc._id, this.normaliseLog(doc)]))
  }

  private async docFromShard(shard: Promise<Map<string, LogMessage>>, id: string): Promise<LogMessage> {
    let result = await shard
    return result.get(id)
  }

  private normaliseLog(r: LogMessage): LogMessage {
    return {
      ...r._source,
      _index: r._index,
      _id: r._id,
      _type: r._type,
      __cursor: r.sort,
    }
  }

  async histogram(query: Query, interval: IRelative, tz: string): Promise<HistogramResults> {
    const url = this.url(`_search?size=0`, this.index)
    let search = this.historicRequest(query)

    const unit = (interval.unit == "millisecond") ? "ms" : interval.unit[0]

    search.aggs = {
      "n": {
        "date_histogram": {
          "field": this.fieldsConfig.timestamp,
          "interval": interval.count + unit,
          "time_zone": tz,
        }
      }
    }
    const results = await Elasticsearch.fetch<ElasticsearchHistogramResponse>(url, "POST", search)
    if (!results.aggregations) {
      return {
        buckets: [],
      }
    }

    return {
      buckets: results.aggregations.n.buckets.map(b => ({
        when: Time.parseText(b.key_as_string),
        count: b.doc_count,
      }))
    }
  }

  private collapsedFields() {
    return [
      this.fieldsConfig.timestamp,
      ...this.fieldsConfig.collapsedFormatting.map(f => f.field)
    ]
  }
}
