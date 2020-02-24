import HTML from "../../index.html"
import { Lookup } from "./Lookup"
import { App } from "../components/App"
import { render } from "inferno"
import { DataSourceType, Logquacious } from "../services/Logquacious"

export const prepareAppConfig = () => ({
  dataSources: [{id: "", urlPrefix: "", index: "", type: DataSourceType.ElasticSearch, fields: "main"}],
  fields: {
    main: {
      collapsedFormatting: [],
    },
  },
  filters: [],
})


export function prepareApp(app?: Logquacious) {
  document.body.innerHTML = HTML
  window.scrollTo = jest.fn()
  app = app || new Logquacious(prepareAppConfig())
  render(<App log={app}/>, document.getElementById('app'))
  return app
}

// Find all the log elements from top to bottom, flattening chunks.
export function resultsFlatten() {
  const results = []
  const logs = Lookup.element("#logs")
  for (const chunk of logs.children) {
    for (const entry of chunk.children) {
      results.push(entry)
    }
  }
  return results
}

