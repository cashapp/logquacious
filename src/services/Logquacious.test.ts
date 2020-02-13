import { Config, DataSourceType, Logquacious } from "./Logquacious"
import { prepareApp, resultsFlatten } from "../helpers/TestHelper"
import { Query } from "./Query"
import { Cursor, HistogramResults, IDataSource, LogMessage, Result } from "../backends/elasticsearch/Elasticsearch"
import { Direction } from "./Prefs"
import { IRelative, Time } from "../helpers/Time"

class MockedElastic implements IDataSource {
  private logMessages: LogMessage[]

  constructor(logMessages: LogMessage[]) {
    this.logMessages = logMessages
  }

  // @ts-ignore
  historicSearch(query: Query, cursor?: Cursor, searchAfterAscending?: boolean): Promise<Result> {
    const r: Result = {
      overview: this.logMessages,
      full: Promise.resolve([new Map<string, LogMessage>()]),
    }
    this.logMessages = []
    return Promise.resolve(r)
  }

  // @ts-ignore
  histogram(query: Query, interval: IRelative, tz: string): Promise<HistogramResults> {
    return Promise.resolve({buckets: []})
  }

  surroundSearch(): Promise<Result> {
    return undefined;
  }
}

describe('logquacious', () => {
  describe('clean config', () => {
    test('correctly defaults timestamp', () => {
      expect(Logquacious.cleanConfig(
        // @ts-ignore
        {fields: {test: {}}}
        )).toEqual({fields: {test: {timestamp: "@timestamp"}}})
    })
  })

  describe('log order', () => {
    const pageSize = 200

    const q = new Query()
    let app: Logquacious
    beforeEach(() => {
      const config: Config = {
        dataSources: [{
          id: "moo",
          type: DataSourceType.ElasticSearch,
          index: "n/a",
          urlPrefix: "n/a",
          fields: "main",
        }],
        filters: [],
        fields: {
          main: {
            collapsedFormatting: [
              {
                field: "@timestamp",
                transforms: ["timestamp"],
              },
              {
                field: "message",
                transforms: [{addClass: "strong"}]
              },
            ],
            collapsedIgnore: [],
            expandedFormatting: [],
          }
        }
      }
      app = new Logquacious(config)
      app = prepareApp(app)
      app.results.clear()
      app.histogram = undefined
    })

    const injectElasticData = (app: Logquacious, number, nOffset: number = 0): LogMessage[] => {
      const start = Time.whenToDate(Time.parseText("2020-01-01T00:00:00Z"))
      const messages: LogMessage[] = []
      for (let i = 0; i < number; i++) {
        const io = i + nOffset
        const ms = start.getTime()
        messages.push({
          "@timestamp": new Date(ms + 1000 * io).toISOString(),
          message: `log ${io}!`,
          __cursor: {
            searchAfter: ms / 1000,
            id: "",
          }
        })
      }
      app.dataSources.set("moo", new MockedElastic(messages))
      return messages
    }

    const check = (app, expected, direction, done?, nextPage: boolean = false, nextPageOlder?: boolean) => {
      app.results.setDirection(direction)

      app.search(q, nextPage, nextPageOlder).then(() => {
        // Wait for the stagger to finish.
        // TODO: Don't rely on a timer.
        setTimeout(() => {
          expected = expected.map(a => a.message)
          const items = resultsFlatten()
          if (direction == Direction.Up) {
            items.reverse()
          }
          const received = items.map(a => a.getElementsByClassName("strong")[0].innerHTML)
          expect(received).toEqual(expected)

          if (done != undefined) {
            done()
          }
        }, 500)
      }).catch(e => {
        console.error(e)
      })
    }

    test("going up first request", done => {
      const messages = injectElasticData(app, pageSize)
      check(app, messages, Direction.Up, done)
    })

    test("going down first request", done => {
      const messages = injectElasticData(app, pageSize)
      check(app, messages, Direction.Down, done)
    })

    test("going down paginate to older (upwards)", done => {
      const msgs2 = injectElasticData(app, pageSize, pageSize)
      check(app, msgs2, Direction.Down, () => {
        const msgs1 = injectElasticData(app, pageSize)
        check(app, [...msgs1, ...msgs2], Direction.Down, done, true, true)
      })
    })

    test("going down paginate to newer (downwards)", done => {
      const msgs1 = injectElasticData(app, pageSize)
      check(app, msgs1, Direction.Down, () => {
        const msgs2 = injectElasticData(app, pageSize, pageSize)
        check(app, [...msgs1, ...msgs2], Direction.Down, done, true, false)
      })
    })

    test("going up paginate to older (downwards)", done => {
      const msgs2 = injectElasticData(app, pageSize, pageSize)
      check(app, msgs2, Direction.Up, () => {
        const msgs1 = injectElasticData(app, pageSize)
        check(app, [...msgs1, ...msgs2], Direction.Up, done, true, true)
      })
    })

    test("going up paginate to newer (upwards)", done => {
      const msgs1 = injectElasticData(app, pageSize)
      check(app, msgs1, Direction.Up, () => {
        const msgs2 = injectElasticData(app, pageSize, pageSize)
        check(app, [...msgs1, ...msgs2], Direction.Up, done, true, false)
      })
    })
  })
})
