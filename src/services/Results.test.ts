import { Lookup } from "../helpers/Lookup"
import { prepareApp, resultsFlatten } from "../helpers/TestHelper"
import { Logquacious } from "./Logquacious"
import { Direction } from "./Prefs"

function resultLookup(chunk: number, entry: number) {
  const logs = Lookup.element("#logs")
  const chunkEl = logs.children[chunk]
  return chunkEl.children[entry]
}

describe('results', () => {
  let app: Logquacious
  let logs: Element
  beforeEach(() => {
    app = prepareApp()
    logs = Lookup.element("#logs")
  })

  describe('that are visible', () => {
    describe('and are going upwards', () => {
      beforeEach(() => {
        app.results.setDirection(Direction.Up)
      })

      test('should append correctly', () => {
        app.results.append({"@timestamp": "2022-01-01", message: "log1"})
        app.results.append({"@timestamp": "2022-01-02", message: "log2"})

        const results = resultsFlatten().map(z => z.textContent)
        expect(results[0]).toMatch(/log2/)
        expect(results[1]).toMatch(/log1/)
      })
    })

    describe('and are going downwards', () => {
      beforeEach(() => {
        app.results.setDirection(Direction.Down)
      })

      test('should append correctly', () => {
        app.results.append({"@timestamp": "2022-01-01", message: "log1"})
        app.results.append({"@timestamp": "2022-01-02", message: "log2"})

        const results = resultsFlatten().map(z => z.textContent)
        expect(results[0]).toMatch(/log1/)
        expect(results[1]).toMatch(/log2/)
      })
    })
  })

  describe('checking the internal chunk structure', () => {
    describe('going upwards', () => {
      beforeEach(() => {
        app.results.setDirection(Direction.Up)
      })

      test('should append correctly', () => {
        app.results.append({"@timestamp": "2022-01-01", message: "log2022"})
        app.results.append({"@timestamp": "2023-01-01", message: "log2023"})

        expect(logs.children.length).toEqual(1)
        expect(logs.children[0].children.length).toEqual(2)
        expect(resultLookup(0, 0).textContent).toMatch(/log2023/)
        expect(resultLookup(0, 1).textContent).toMatch(/log2022/)
      })

      test('should prepend correctly', () => {
        app.results.prepend({"@timestamp": "2023-01-01", message: "log2023"})
        app.results.prepend({"@timestamp": "2022-01-01", message: "log2022"})

        expect(logs.children.length).toEqual(1)
        expect(logs.children[0].children.length).toEqual(2)
        expect(resultLookup(0, 0).textContent).toMatch(/log2023/)
        expect(resultLookup(0, 1).textContent).toMatch(/log2022/)
      })

      test('should append then prepend correctly', () => {
        app.results.append({"@timestamp": "2022-01-02", message: "log2"})
        app.results.append({"@timestamp": "2022-01-03", message: "log3"})
        app.results.prepend({"@timestamp": "2022-01-01", message: "log1"})
        app.results.append({"@timestamp": "2022-01-04", message: "log4"})

        // Two chunks should be created
        expect(logs.children.length).toEqual(3)

        expect(resultLookup(0, 0).textContent).toMatch(/log4/)
        expect(resultLookup(1, 0).textContent).toMatch(/log3/)
        expect(resultLookup(1, 1).textContent).toMatch(/log2/)
        expect(resultLookup(2, 0).textContent).toMatch(/log1/)
      })
    })
  })

  describe('going downwards', () => {
    beforeEach(() => {
      app.results.setDirection(Direction.Down)
    })

    test('should append correctly', () => {
      app.results.append({"@timestamp": "2022-01-01", message: "log2022"})
      app.results.append({"@timestamp": "2023-01-01", message: "log2023"})

      expect(logs.children.length).toEqual(1)
      expect(logs.children[0].children.length).toEqual(2)
      expect(resultLookup(0, 0).textContent).toMatch(/log2022/)
      expect(resultLookup(0, 1).textContent).toMatch(/log2023/)
    })

    test('should prepend correctly', () => {
      app.results.prepend({"@timestamp": "2023-01-01", message: "log2023"})
      app.results.prepend({"@timestamp": "2022-01-01", message: "log2022"})

      expect(logs.children.length).toEqual(1)
      expect(logs.children[0].children.length).toEqual(2)
      expect(resultLookup(0, 0).textContent).toMatch(/log2022/)
      expect(resultLookup(0, 1).textContent).toMatch(/log2023/)
    })

    test('should append then prepend correctly', () => {
      app.results.append({"@timestamp": "2022-01-02", message: "log2"})
      app.results.append({"@timestamp": "2022-01-03", message: "log3"})
      app.results.prepend({"@timestamp": "2022-01-01", message: "log1"})
      app.results.append({"@timestamp": "2022-01-04", message: "log4"})

      // Two chunks should be created
      expect(logs.children.length).toEqual(3)

      expect(resultLookup(0, 0).textContent).toMatch(/log1/)
      expect(resultLookup(1, 0).textContent).toMatch(/log2/)
      expect(resultLookup(1, 1).textContent).toMatch(/log3/)
      expect(resultLookup(2, 0).textContent).toMatch(/log4/)
    })
  })
})
