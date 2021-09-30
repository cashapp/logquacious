import {Query} from "services/Query";
import {Filter} from "./App";
import {When} from "../helpers/Time";

interface Props {
  queries: Map<string, Query>
  onQuerySelection: (query: Query) => void
}

export const RecentSearches = ({queries, onQuerySelection}: Props) => {
  const queryListing = Array.from(queries, ([url, query]) =>
    (query.terms === null || query.terms === "") ? null :
      <QueryListing
        key={url}
        query={query}
        onSelection={() => onQuerySelection(query)}
      />
    ).reverse() // Puts more recent searches at the top of the list.

  if(queryListing.filter(item => item !== null).length === 0) return null

  return (
    <section id="recent-searches" class="section">
      <article class="message">
        <div class="message-header">
          <p>Your recent searches</p>
        </div>
        <div class="message-body">
          <div class="content recent-search-list">{queryListing}</div>
        </div>
      </article>
    </section>
  )
}

interface QueryListingProps {
  query: Query
  onSelection: () => void
}

const QueryListing = ({query, onSelection}: QueryListingProps) => {

  const activeFilters = query.filters.filter(
    filter => filter.selected !== "" && filter.selected !== filter.default);

  const filterTitle = (filter: Filter, value: string | null) => {
    const filterItem = filter.items.find(item => item.id === value)
    return filterItem.shortTitle === undefined ? filterItem.title : filterItem.shortTitle
  }

  const whenToText = (when: When) => {
    switch (when.kind) {
      case "now":
        return "now"
      case "moment":
        return when.moment.format("DD-MMM-YYYY HH:mm:ss")
      case "relative":
        return `${when.count}${when.unit.substring(0, 1)}`
      default:
        return ""
    }
  }

  return <div class="recent-search-entry" onClick={onSelection}>
    <span className="search-terms">{query.terms}</span>
    <div className="search-filters">
      <span className="tag is-primary is-light">
        {whenToText(query.startTime)} &ndash; {whenToText(query.endTime)}
      </span>
      {activeFilters.map(
        filter => <span className="tag is-primary is-light">{filter.title}: {filterTitle(filter,
          filter.selected)}</span>)}
    </div>
  </div>
};
