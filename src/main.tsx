import { render } from 'inferno'
import { App } from "./components/app"
import { Logquacious } from "./services/logquacious"
import { Error } from "./components/error"

const app = document.getElementById('app')

export async function loadConfig() {
  try {
    const resp = await fetch("config.json")
    const manager = new Logquacious(await resp.json())
    render(<App log={manager}/>, app)
  } catch (e) {
    console.log(e)
    console.error("Could not load config.json. Please place it in the same path as index.html.")
    render((
      <Error message={`There was an error loading config.json: ${e}`} visible={true}/>
    ), app)
  }
}

loadConfig()
render(<b>Loading Logquacious</b>, app)

