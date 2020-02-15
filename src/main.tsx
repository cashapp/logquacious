import { render } from 'inferno'
import { App } from "./components/App"
import { Logquacious } from "./services/Logquacious"
import { Error } from "./components/Error"

const app = document.getElementById('app')

export async function loadConfig() {
  try {
    const resp = await fetch("config.json")
    const manager = new Logquacious(await resp.json())
    render(<App log={manager}/>, app)
  } catch (e) {
    // tslint:disable-next-line:no-console
    console.log(e)
    // tslint:disable-next-line:no-console
    console.error("Could not load config.json. Please place it in the same path as index.html.")

    render((
      <Error message={`There was an error loading config.json: ${e}`} visible={true}/>
    ), app)
  }
}

loadConfig()
render(<b>Loading Logquacious</b>, app)

