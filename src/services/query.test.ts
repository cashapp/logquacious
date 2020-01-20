import { Query } from "./query"
import { Filter, FilterType } from "../components/app"

const fruitFilter: Filter = {
  id: "fruit",
  default: "banana",
  title: "Fruit",
  type: FilterType.singleValue,
  urlKey: "fru",
  items: [
    {
      id: undefined,
      shortTitle: "all",
      title: "All Fruits",
    },
    {
      id: "app",
      shortTitle: "apples",
      title: "🍎",
    },
    {
      id: "ban",
      shortTitle: "bananas",
      title: "🍌",
    },
  ],
}

const fruitAllowEmpty: Filter = {
  ...fruitFilter,
  items: [
    {
      id: "",
      shortTitle: "no fruit",
      title: "No Fruits",
    },
    fruitFilter.items[1],
    fruitFilter.items[2],
  ]
}

describe('query', () => {
  describe('from/to url', () => {
    test('empty', () => {
      expect(Query.fromURL([], "").toURL()).toEqual("")
    })

    describe('fruits with undefined', () => {
      test('filter on empty', () => {
        expect(Query.fromURL([fruitFilter], "").toURL()).toEqual("fru=banana")
      })
      test('filter on selected', () => {
        expect(Query.fromURL([fruitFilter], "fru=app").toURL()).toEqual("fru=app")
      })
      test('filter on undefined', () => {
        expect(Query.fromURL([fruitFilter], "fru=").toURL()).toEqual("fru=")
      })
      test('filter on undefined check', () => {
        expect(Query.fromURL([fruitFilter], "fru=").filters[0].selected).toEqual(undefined)
      })
    })

    describe('fruits with empty', () => {
      test('filter on empty', () => {
        expect(Query.fromURL([fruitAllowEmpty], "").toURL()).toEqual("fru=banana")
      })
      test('filter on selected', () => {
        expect(Query.fromURL([fruitAllowEmpty], "fru=app").toURL()).toEqual("fru=app")
      })
      test('filter on undefined', () => {
        expect(Query.fromURL([fruitAllowEmpty], "fru=").toURL()).toEqual("fru=")
      })
      test('filter on undefined check', () => {
        expect(Query.fromURL([fruitAllowEmpty], "fru=").filters[0].selected).toEqual("")
      })
    })
  })
})
