import { Component } from "inferno"
import Changes from "../../CHANGELOG.json"

function groupBy(xs, key) {
  return xs.reduce((rv, x) => {
    (rv[x[key]] = rv[x[key]] || []).push(x)
    return rv
  }, {})
}

export class ChangeLog extends Component {
  whatIcon(icon: string): string {
    switch (icon) {
      case "bug":
        return "🐞 "
      case "enhancement":
        return "🔨 "
    }
    return ""
  }

  item(change) {
    const icon = this.whatIcon(change.type)
    return (
      <li>{icon}{change.what} (<a href={`https://github.com/cashapp/logquacious/pull/${change.pr}`}>#{change.pr}</a>)</li>
    )
  }

  render() {
    const grouped = groupBy(Changes, "when")

    return (
      <ul>
        {Object.keys(grouped).map(k => <li>{k}
          <ul>{grouped[k].map(item => this.item(item))}</ul>
        </li>)}
      </ul>
    )
  }
}