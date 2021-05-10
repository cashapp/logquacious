import { ITracker } from "./Logquacious";
import { Query, SerializedData } from "./Query";
import { Filter } from "../components/App";

const TRACKER_STORAGE_KEY = "historicalQueries"
const MAX_ITEMS_ALLOWED = 20

export class BrowserStorageTracker implements ITracker {
  storage: Storage
  queries: Map<string, Query>

  constructor(storage: Storage, filters: Filter[]) {
    this.storage = storage;
    this.queries = new Map()
    const persistedQueries = this.storage.getItem(TRACKER_STORAGE_KEY)
    if(persistedQueries != null) {
      const queries: SerializedData[] = JSON.parse(persistedQueries)
      queries.forEach(serializedData => {
        const query = Query.deserialize(serializedData, filters)
        this.queries.set(query.toURL(), query)
      });
    }
  }

  trackSearch(query: Query) {
    const queryUrl = query.toURL()
    if(this.queries.has(queryUrl)) {
      return
    }

    this.queries.set(queryUrl, query)
    if(this.queries.size > MAX_ITEMS_ALLOWED) {
      this.queries.delete(this.queries.keys()[0])
    }

    this.updateStorage()
  }

  trackedSearches(): Map<string, Query> {
    return this.queries;
  }

  private updateStorage() {
    const serializedData = Array.from(this.queries.values(), query => query.serialize())
    this.storage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(serializedData))
  }
}