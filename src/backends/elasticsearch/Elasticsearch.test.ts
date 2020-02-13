import { Elasticsearch } from "./Elasticsearch"
import { Query } from "../../services/Query"
import { Now, Time } from "../../helpers/Time"

const prefix = 'https://es-server'
const index = "my-index"

describe('elasticsearch', () => {
  let es: Elasticsearch
  const docId = "docid"
  const docShort = {
    _source: {hello: "12345"},
    _index: index,
    _id: docId,
  }
  const docExpanded = {
    ...docShort,
    _source: {
      ...docShort._source,
      exception: "oh noes",
    }
  }

  beforeEach(() => {
    fetchMock.resetMocks()
    es = new Elasticsearch(prefix, index, {
      timestamp: "custom_timestamp",
      collapsedFormatting: [
        {
          field: "message",
          transforms: [],
        },
        {
          field: "level",
          transforms: [],
        }
      ],
    })
  })

  test('loadDocument', done => {
    fetchMock.mockResponseOnce(JSON.stringify(docShort))

    es.loadDocument(index, "my-doc", docId).then(data => {
      expect(data).toEqual({
        hello: "12345",
        _index: index,
        _id: docId,
        __cursor: undefined,
      })
      done()
    })
    expect(fetchMock.mock.calls.length).toEqual(1)
    expect(fetchMock.mock.calls[0][0]).toEqual(prefix + "/my-index/my-doc/docid")
  })

  test('historicSearch', done => {
    const hits = {
      hits: {
        hits: [docShort]
      },
    }
    fetchMock
    // _search response
      .once(JSON.stringify(hits))
      // _mget response
      .once(JSON.stringify({
        docs: [docExpanded],
      }))

    const query = new Query()
      .withNewTerms("crashy mccrashface")
      .withPageSize(5)
      .withTimeRange([Time.wrapRelative(-1, "w"), Now])

    es.historicSearch(query).then(data => {
      expect(fetchMock.mock.calls.length).toEqual(2)

      // expected _search request
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
        "_source": [
          "custom_timestamp", "message", "level"
        ],
        "docvalue_fields": [{"field": "custom_timestamp", "format": "date_time"}],
        "query": {
          "bool": {
            "must": [
              {
                "query_string": {
                  "analyze_wildcard": true,
                  "default_operator": "AND",
                  "fuzziness": 0,
                  "query": "crashy mccrashface"
                }
              }, {
                "range": {
                  "custom_timestamp": {
                    "format": "strict_date_optional_time",
                    "gte": "now-1w",
                    "lte": "now"
                  }
                }
              }
            ]
          }
        },
        "size": 5,
        "sort": [{"custom_timestamp": {"order": "desc"}}],
        "timeout": "30000ms"
      })

      // expected _mget request
      expect(fetchMock.mock.calls[1][1].body).toEqual(JSON.stringify({
        docs: [{_id: docId}]
      }))

      // _full is a promise, so we extract it out and resolve it after an assertion
      const {_full, ...overview} = data.overview[0]
      const expectedShort = {
        __cursor: undefined,
        _id: "docid",
        _index: "my-index",
        "hello": "12345",
      }
      expect(overview).toEqual(expectedShort)

      _full.then(d => {
        expect(d).toEqual({
          ...expectedShort,
          "exception": "oh noes",
        })

        done()
      })
    })
  })
})
