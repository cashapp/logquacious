import { ITracker } from "./Logquacious";
import { Query, SerializedData } from "./Query";
import {Filter} from "../components/App";

const HISTORY_TRACKER_STORAGE_KEY = "historicalQueries"
const MAX_ITEMS_ALLOWED = 20

export class HistoryTracker implements ITracker {
  storage: Storage
  queries: Map<string, Query>

  constructor(storage: Storage, filters: Filter[]) {
    this.storage = storage;
    this.queries = new Map()
    const historicalQueries = this.storage.getItem(HISTORY_TRACKER_STORAGE_KEY)
    if(historicalQueries != null) {
      const queries: Array<SerializedData> = JSON.parse(historicalQueries)
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

    this.updateLocalStorage()
  }

  trackedSearches(): Map<string, Query> {
    return this.queries;
  }

  updateLocalStorage() {
    const serializedData = Array.from(this.queries.values(), query => query.serialize())
    this.storage.setItem(HISTORY_TRACKER_STORAGE_KEY, JSON.stringify(serializedData))
  }
}