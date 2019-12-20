import { Component } from "inferno"

interface Props {
  visible: boolean
}

class DefaultWelcome extends Component {
  render() {
    return <article class="message">
      <div class="message-header">
        <p>Welcome to Logquacious!</p>
      </div>
      <div class="message-body">
        <div class="content">
          <h4>General workflow</h4>
          <ul>
            <li>Type and press enter to search.</li>
            <li>Click on a log entry to expand it.</li>
            <li>Click on a field to filter on it.</li>
          </ul>
          <h4>Search tips</h4>
          <ul>
            <li>Searches use
              <a target="_blank" href="https://www.elastic.co/guide/en/elasticsearch/reference/7.3/query-dsl-query-string-query.html#query-string-syntax"> Lucene Query Syntax</a>.
            </li>
            <li>
              Most fields <strong>match on the entire string</strong>. All fields are <strong>case-insensitive</strong>
            </li>
            <li>
              You can negate results with <code>-</code>. Example: <code>-debug</code>
            </li>
            <li>
              Use <code>field:value</code> to search for a value in a field. Use <code>.</code> to separate nested
              JSON keys. Example: <code>http.response_code:200</code>.
            </li>
            <li>
              You can use logical operators <code>AND</code>.
              By default all terms are <code>AND</code>ed together.
              Example: <code>moe OR larry</code>
            </li>
            <li>
              It is possible to group logical operators with parenthesis <code>()</code>.
              Examples: <code>(a AND b) OR (c AND d)</code>
            </li>
            <li>To look up part of a word for fields that support phrase search, use wildcards, like <code>except*</code></li>
          </ul>
          <h4>Cheat sheet</h4>
          <ul>
            <li><a href="?q=service:www"><code>service:apache</code></a> apache logs only</li>
            <li><a href="?q=level:error"><code>level:error</code></a> errors</li>
            <li><a href="?q=_exists:exception"><code>_exists_:exception</code></a> all exceptions</li>
          </ul>
          <p>
            Please feel free to submit suggestions, bugs or feedback on <a href="https://github.com/cashapp/logquacious">Cash App's Logquacious GitHub repository</a>.
          </p>
        </div>
      </div>
    </article>
  }
}

export class Welcome extends Component<Props> {
  render() {
    let Welcome = <DefaultWelcome/>
    try {
      const CustomWelcome = require('../../custom/welcome').default
      Welcome = <CustomWelcome/>
    } catch (ex) {
      if (ex.code != "MODULE_NOT_FOUND") {
        throw ex
      }
    }

    return (
      <section id="log-welcome" class={`section ${this.props.visible ? "" : "is-hidden"}`}>
        {Welcome}
      </section>
    )
  }
}
