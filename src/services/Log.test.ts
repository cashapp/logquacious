import { QueryManipulator, showContextButton } from "./Log"
import { Query } from "./Query"
import { prepareApp, prepareAppConfig } from "../helpers/TestHelper"
import { Logquacious } from "./Logquacious"

function parseHTML(html: string): HTMLDivElement {
  const el = document.createElement('div')
  el.innerHTML = html
  return el
}

function getLink(html: string): string {
  const el = parseHTML(html)
  return el.querySelector("a").href
}

describe('log', () => {
  test('collapsed should show number correctly', () => {
    const config = prepareAppConfig()
    config.fields.main.collapsedFormatting = [
      {
        field: "@timestamp",
        transforms: ["timestamp"],
      },
      {
        field: "message",
        transforms: [{addClass: "strong"}]
      },
    ]
    const lq = new Logquacious(config)
    const app = prepareApp(lq)
    const doc = app.results.logFormatter.build({
      "@timestamp": new Date(),
      "message": "something",
      "number": 5,
    })

    expect(doc.textContent).toContain("number=5")
  })

  describe('showIfDifferent', () => {
    let app: Logquacious
    beforeEach(() => {
      const config = prepareAppConfig()
      config.fields.main.collapsedFormatting = [
        {
          field: "@timestamp",
          transforms: ["timestamp"],
        },
        {
          field: "service",
        },
        {
          field: "container",
          transforms: [
            {showIfDifferent: "service"},
          ]
        },
        {
          field: "message",
        },
      ]
      const lq = new Logquacious(config)
      app = prepareApp(lq)
    })

    test('same', () => {
      const doc = app.results.logFormatter.build({
        "@timestamp": new Date(),
        "service": "something",
        "container": "something",
        "message": "msg",
      })

      // \xa0 is a non breaking space
      expect(doc.textContent).toContain("something\xa0msg")
      expect(doc.textContent).not.toContain("something\xa0something\xa0msg")
    })

    test('different', () => {
      const doc = app.results.logFormatter.build({
        "@timestamp": new Date(),
        "service": "something",
        "container": "moo",
        "message": "msg",
      })

      // \xa0 is a non breaking space
      expect(doc.textContent).toContain("something\xa0moo\xa0msg")
    })
  })

  describe('showContextButton', () => {
    let qm: QueryManipulator

    beforeEach(() => {
      qm = {
        getQuery: () => {
          return new Query()
        },
        // tslint:disable-next-line:no-empty
        changeQuery: () => {
        },
        getFilters: () => {
          return []
        },
      }
    })

    test('not a regexp', () => {
      const html = showContextButton(
        {title: "", keep: ["substring"]},
        {
          "asubstringhere": "a",
        },
        undefined,
        qm,
      )
      expect(html).toBeUndefined()
    })

    test('a basic regexp', () => {
      const html = showContextButton(
        {title: "", keep: ["/subst+ring/"]},
        {
          "asubsttttringhere": "a",
        },
        undefined,
        qm,
      )
      expect(html).toBeDefined()
    })

    test('not found', () => {
      const html = showContextButton(
        {title: "", keep: ["/with.dots/"]},
        {
          "a": "a",
          "z": "z",
        },
        undefined,
        qm,
      )
      expect(html).toBeUndefined()
    })

    test('nested array with regexp', () => {
      const html = showContextButton(
        {title: "", keep: ["/with.dots/"]},
        {
          "a": "a",
          "nested": [
            {"with.dots": "!"},
          ],
          "z": "z",
        },
        undefined,
        qm,
      )
      expect(getLink(html)).toContain('q=nested.with.dots:%22!%22')
    })

    test('nested object with regexp', () => {
      const html = showContextButton(
        {title: "", keep: ["/with.dots/"]},
        {
          "a": "a",
          "nested": {"with.dots": "!"},
          "z": "z",
        },
        undefined,
        qm,
      )
      expect(getLink(html)).toContain('q=nested.with.dots:%22!%22')
    })

    test('remove non-context query', () => {
      const q = new Query()
        .withAddTerms("service:zoot")
        .withAddTerms("otherfilter:true")
      qm.getQuery = () => q

      const html = showContextButton(
        {title: "", keep: ["service"]},
        {
          "a": "a",
          "service": "zoot",
        },
        undefined,
        qm,
      )
      expect(getLink(html)).toContain('service:%22zoot%22')
      expect(getLink(html)).not.toContain('otherfilter')
    })

    test('empty context should display and remove all filters', () => {
      const q = new Query()
        .withAddTerms("service:zoot")
        .withAddTerms("otherfilter:true")
      qm.getQuery = () => q

      const html = showContextButton(
        {title: "", keep: undefined},
        {
          "a": "a",
          "service": "zoot",
        },
        undefined,
        qm,
      )
      expect(getLink(html)).toContain('q=&')  // No terms
    })
  })
})
