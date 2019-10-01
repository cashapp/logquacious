import { render } from 'inferno'
import { App } from "./components/app"
import { Logquacious } from "./services/logquacious"

fetch("config.json")
  .then(resp => resp.json()
    .then(config => {
        const manager = new Logquacious(config)
        render(<App log={manager}/>, document.getElementById('app'))
      }
    )
  )
