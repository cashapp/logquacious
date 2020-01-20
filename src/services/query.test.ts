import { Query } from "./query"
import { Filter, FilterType } from "../components/app"

const fruitFilter: Filter = {
  id: "fruit",
  default: "banana",
  title: "Fruit",
  type: FilterType.singleValue,
  urlKey: "fru",
  remember: true,
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
    {
      id: "cuc",
      shortTitle: "cucumber",
      title: "🥒",
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
    fruitFilter.items[3],
  ]
}

describe('query', () => {
  describe('from/to url', () => {
    test('empty', () => {
      expect(Query.load([], {urlQuery: ""}).toURL()).toEqual("")
    })

    describe('fruits with undefined', () => {
      test('empty', () => {
        expect(Query.load([fruitFilter], {urlQuery: ""}).toURL()).toEqual("fru=banana")
      })
      test('filter on selected', () => {
        expect(Query.load([fruitFilter], {urlQuery: "fru=app"}).toURL()).toEqual("fru=app")
      })
      test('filter on undefined', () => {
        expect(Query.load([fruitFilter], {urlQuery: "fru="}).toURL()).toEqual("fru=")
      })
      test('filter on undefined check', () => {
        expect(Query.load([fruitFilter], {urlQuery: "fru="}).filters[0].selected).toEqual(undefined)
      })
    })

    describe('fruits with empty', () => {
      test('empty url should use default', () => {
        expect(Query.load([fruitAllowEmpty], {urlQuery: ""}).toURL()).toEqual("fru=banana")
      })
      test('filter on selected', () => {
        expect(Query.load([fruitAllowEmpty], {urlQuery: "fru=app"}).toURL()).toEqual("fru=app")
      })
      test('filter on undefined', () => {
        expect(Query.load([fruitAllowEmpty], {urlQuery: "fru="}).toURL()).toEqual("fru=")
      })
      test('filter on undefined check', () => {
        expect(Query.load([fruitAllowEmpty], {urlQuery: "fru="}).filters[0].selected).toEqual("")
      })
    })
  })

  describe('storage', () => {
    const storage: Storage = window.localStorage
    test('fruit is unset in url (default), remember filter', () => {
      storage.setItem("query", JSON.stringify({"fru": "app"}))
      const q = Query.load([fruitFilter], {storage})
      expect(q.filters[0].selected).toEqual("app")
    })

    test('fruit is empty string (undefined), must not use storage', () => {
      storage.setItem("query", JSON.stringify({"fru": "app"}))
      const q = Query.load([fruitFilter], {urlQuery: 'fru=', storage})
      expect(q.filters[0].selected).toEqual(undefined)
    })

    test('fruit is empty string (empty), must not use storage', () => {
      storage.setItem("query", JSON.stringify({"fru": "app"}))
      const q = Query.load([fruitAllowEmpty], {urlQuery: 'fru=', storage})
      expect(q.filters[0].selected).toEqual("")
    })

    test('url is set, must ignore storage', () => {
      storage.setItem("query", JSON.stringify({"fru": "app"}))
      const q = Query.load([fruitFilter], {urlQuery: 'fru=cuc', storage})
      expect(q.filters[0].selected).toEqual("cuc")
    })
  })
})
