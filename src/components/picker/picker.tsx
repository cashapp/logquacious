import { Component } from "inferno"
import { Endpoint, InvalidDate, Now, Range, Time, When } from "../../helpers/Time"
import { PickerTextInput } from "./pickerTextInput"
import { PickerRangeButton } from "./pickerRangeButton"
import { Button } from "../Button"
import flatpickr from "flatpickr"
import { MenuItem } from "../Menu/MenuItem"
import { MenuDropdown } from "../Menu/MenuDropDown"

export type ChangeRangeCallback = (range: Range) => void

type InputRange = [InputInfo, InputInfo]

export type InputInfo = {
  when: When
  text: string
  isValid: boolean
}

interface Props {
  range: Range
  onChange: ChangeRangeCallback
}

interface State {
  isActive: boolean
  inputs: InputRange
}

export class Picker extends Component<Props, State> {
  private picker: flatpickr.Instance

  // When true, the user has selected the first date in the picker, but not the second.
  // This is used to prevent an update of the picker while they're choosing, since it
  // resets the state within flatpickr.
  private isPicking = false

  constructor(props) {
    super(props)

    this.state = {
      isActive: false,
      inputs: Picker.rangeToInputRange(props.range),
    }
  }

  static whenToInput(when: When): InputInfo {
    return {
      when,
      text: Time.whenToText(when),
      isValid: true,
    }
  }

  static rangeToInputRange(range: Range): InputRange {
    return [
      Picker.whenToInput(range[Endpoint.Start]),
      Picker.whenToInput(range[Endpoint.End]),
    ]
  }

  componentWillReceiveProps(nextProps: Props): void {
    if (!Time.isRangeEqual(nextProps.range, this.props.range)) {
      this.setState({inputs: Picker.rangeToInputRange(nextProps.range)})
    }
  }

  componentDidUpdate(prevProps: Props): void {
    const propsRangeIsEqual = Time.isRangeEqual(prevProps.range, this.toRange())
    if (!this.isPicking && !propsRangeIsEqual) {
      this.updateFlatPickr()
    }
  }

  saveFlatPickrRef = (el: HTMLElement) => {
    this.picker = flatpickr(el, {
      mode: "range",
      inline: true,
      onChange: (d) => {
        const inputs = [...this.state.inputs] as InputRange

        inputs[0] = Picker.whenToInput(Time.wrapDate(d[0]))
        this.isPicking = true
        if (d.length === 2) {
          this.isPicking = false
          inputs[1] = Picker.whenToInput(Time.wrapDate(d[1]))
        }

        this.setState({inputs})
      }
    })
    this.updateFlatPickr()
  }

  reset = () => {
    this.setState({inputs: Picker.rangeToInputRange(this.props.range)})
    this.updateFlatPickr()
  }

  handleMouseEnter = () => this.setState({isActive: true})
  handleMouseLeave = () => this.setState({isActive: false})
  handleStartText = (e: Event) => this.handleChangedText(Endpoint.Start, (e.target as HTMLInputElement).value)
  handleEndText = (e: Event) => this.handleChangedText(Endpoint.End, (e.target as HTMLInputElement).value)
  handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      this.submit()
    }
  }

  handleChangedText(endpoint: Endpoint, text: string) {
    const when = Time.parseText(text)
    const isValid = when !== InvalidDate
    const inputs = [...this.state.inputs] as InputRange
    inputs[endpoint] = {
      when,
      text,
      isValid,
    }
    this.setState({inputs})
  }

  handleNewRange = (delta: When) => {
    const inputs = [...this.state.inputs] as InputRange
    inputs[0].when = delta
    inputs[1].when = Now
    this.setState({inputs}, this.submit)
  }

  handleSubmit = () => this.submit()

  submit = (closeHover: boolean = true) => {
    this.props.onChange(this.toRange())
    this.setState({isActive: !closeHover})
  }

  toRange(): Range {
    return Picker.inputsToRange(this.state.inputs)
  }

  static inputsToRange(inputRange: InputRange): Range {
    return inputRange.map(i => i.when) as Range
  }

  updateFlatPickr() {
    const dates = this.toRange().map(w => Time.whenToDate(w))
    this.picker.setDate(dates)
  }

  render() {
    const rangeButtonProps = {
      range: this.toRange(),
      onClick: this.handleNewRange,
    }
    const resetActive = !Time.isRangeEqual(this.toRange(), this.props.range)
    const diff = Time.diff(this.state.inputs[0].when, this.state.inputs[1].when)
    const validRange = diff && diff.asMilliseconds() > 0
    const humanRange = validRange ? Time.getRangeHuman(diff) : "Invalid range"

    return (
      <MenuDropdown
        title="Time"
        extraDropdownClass="time-picker"
        isActive={this.state.isActive}
        onMouseEnter={this.handleMouseEnter}
        onMouseLeave={this.handleMouseLeave}
      >
        <MenuItem id="time-picker-dropdown">
          <div class="columns">
            <div class="column is-narrow">
              <h1 class="title is-6">Picker</h1>
              <div ref={this.saveFlatPickrRef}/>
            </div>
            <div class="column">
              <h1 class="title is-6">Quick Ranges</h1>
              <div class="section" id="quick-ranges">
                <div class="buttons">
                  <PickerRangeButton {...rangeButtonProps} delta="30s"/>
                  <PickerRangeButton {...rangeButtonProps} delta="1m"/>
                  <PickerRangeButton {...rangeButtonProps} delta="5m"/>
                  <PickerRangeButton {...rangeButtonProps} delta="15m"/>
                  <PickerRangeButton {...rangeButtonProps} delta="1h"/>
                  <PickerRangeButton {...rangeButtonProps} delta="2h"/>
                </div>
                <div class="buttons">
                  <PickerRangeButton {...rangeButtonProps} delta="4h"/>
                  <PickerRangeButton {...rangeButtonProps} delta="12h"/>
                  <PickerRangeButton {...rangeButtonProps} delta="1d"/>
                  <PickerRangeButton {...rangeButtonProps} delta="2d"/>
                  <PickerRangeButton {...rangeButtonProps} delta="1w"/>
                  <PickerRangeButton {...rangeButtonProps} delta="2w"/>
                </div>
              </div>
              <div class="content">
                <PickerTextInput
                  value={this.state.inputs[Endpoint.Start]}
                  onChange={this.handleStartText}
                  onKeyPress={this.handleKeyPress}
                  title="Start"
                  placeholder="-5h, ISO 8601..."
                />
                <PickerTextInput
                  value={this.state.inputs[Endpoint.End]}
                  onChange={this.handleEndText}
                  onKeyPress={this.handleKeyPress}
                  title="End"
                  placeholder="Leave empty for current time"
                />

                <div class={`is-pulled-right ${!validRange ? "has-text-danger" : ""}`}>{humanRange}</div>
                <Button active={validRange} onClick={this.handleSubmit}>Apply</Button>
                <Button active={resetActive} onClick={this.reset}>Reset</Button>
              </div>

              <h1 class="title is-6">Hints</h1>
              <div class="content">
                <ul>
                  <li>Supports ISO 8601, and relative amounts, e.g. -1h, -2w.</li>
                  <li>Timezone offsets (e.g. +10:00) are supported.</li>
                  <li>Unless specified, times are based on your computer's settings.</li>
                </ul>
              </div>
            </div>
          </div>
        </MenuItem>
      </MenuDropdown>
    )
  }
}

