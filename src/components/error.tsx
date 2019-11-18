import { Component } from "inferno"

interface Props {
  visible: boolean
  message: string | HTMLElement
}

export class Error extends Component<Props> {
  render() {
    return (
      <section id="log-error" class={`section ${this.props.visible ? "" : "is-hidden"}`}>
        <article class="message">
          <div class="message-header">
            <p>Error 😿</p>
          </div>
          <div class="message-body">
            <div class="content">
              <h4>Message</h4>
              {(this.props.message instanceof HTMLElement) ? this.props.message : <pre>{this.props.message}</pre> }
              <h4>Potential Fixes</h4>
              <ul>
                <li>
                  Check the debug console in your browser to see a potentially more detailed error.
                </li>
                <li>
                  Make sure you have access to the URL mentioned, if any.
                </li>
                <li>
                  If you're using Privacy Badger or a similar ad tracking extension,
                  please allow it to store cookies over the domain specified above.
                  This might be needed if you use SSO.
                </li>
              </ul>
            </div>
          </div>
        </article>
      </section>
    )
  }
}