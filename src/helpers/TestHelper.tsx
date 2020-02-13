// @ts-ignore
import HTML from "../../index.html"
import { Lookup } from "./Lookup"
import { App } from "../components/App"
import { render } from "inferno"
import { DataSourceType, Logquacious } from "../services/Logquacious"

export function prepareApp(app?: Logquacious) {
  document.body.innerHTML = HTML
  window.scrollTo = jest.fn()
  app = app || new Logquacious({
    dataSources: [{id: "", urlPrefix: "", index: "", type: DataSourceType.ElasticSearch, fields: "main"}],
    fields: {
      main: {
        collapsedFormatting: [],
      },
    },
    filters: [],
  })
  render(<App log={app}/>, document.getElementById('app'))
  return app
}

// Find all the log elements from top to bottom, flattening chunks.
export function resultsFlatten() {
  const results = []
  const logs = Lookup.element("#logs")
  for (let chunkIdx = 0; chunkIdx < logs.children.length; chunkIdx++) {
    for (let entryIdx = 0; entryIdx < logs.children[chunkIdx].children.length; entryIdx++) {
      results.push(logs.children[chunkIdx].children[entryIdx])
    }
  }
  return results
}

