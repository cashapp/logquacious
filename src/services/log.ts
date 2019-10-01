import { LogMessage } from "../backends/elasticsearch"
import { CopyHelper } from "../helpers/copyHelper"

export type FieldsConfig = {
  collapsedFormatting: ILogRule[]
  collapsedIgnore?: string[]
  expandedFormatting?: Record<string, ExpandedViewFormatter>

  // Don't create links for values beneath this depth, for when you don't index this deep.
  maxDepthForLinks?: number

  // Always create links for these fields by prefix. Recommended for them to be indexed.
  maxDepthForLinksExceptions?: string[]
}

export interface ILogRule {
  field: string
  transforms: string | object
}

interface FormatField {
  // Original string value before formatting
  readonly original: string
  // Formatted value, modified by the transformer, maybe be HTML.
  current: string
  // Classes to apply to the formatted value
  classes: string[],
  // The entire entry. This should not be modified by the transform.
  readonly entry: any,
  // Hex color value to apply to the formatted value
  color: string,
  // Tooltip to show on hover
  tooltip: string,
}

export interface ExpandedViewFormatField {
  readonly original: any,
  readonly indent: string,
  readonly hrefMaker: HrefMaker,
  copyBag: Array<any>
}

/**
 * Transform is a function that transforms a log record field for formatting. It
 * returns the transformed field. It may transform its input in-place.
 */
type Transform = (input: FormatField) => FormatField

type ExpandedViewFormatter = (input: ExpandedViewFormatField) => string

/**
 * HrefMaker returns an href link that appends the term onto the current query.
 */
export type HrefMaker = (term: string) => string

export class LogFormatter {
  private readonly copyHelper: CopyHelper
  private templateContent: DocumentFragment
  private config: FieldsConfig

  constructor(config: FieldsConfig) {
    if (config == undefined) {
      console.warn("fieldsConfig is not set")
      // @ts-ignore
      config = {}
    }
    config.collapsedFormatting = config.collapsedFormatting || []
    config.collapsedIgnore = config.collapsedIgnore || []
    config.expandedFormatting = config.expandedFormatting || {}
    this.config = config
    this.copyHelper = new CopyHelper()
  }

  setTemplate(templateContent: DocumentFragment) {
    this.templateContent = templateContent
    return this
  }

  // Clean a log entry for display.
  private cleanLog(entry: LogMessage): any {
    let out: LogMessage = {...entry}
    delete out['__cursor']
    return out
  }

  build(entry: LogMessage, hrefMaker: HrefMaker): DocumentFragment {
    const cursor = entry.__cursor
    entry = this.cleanLog(entry)

    // Make shallow copy here before we mangle entry (we only modify top-level fields).
    const origEntry: LogMessage = {...entry}
    // The expanded part is lazily rendered.
    let isExpandedRendered = false

    let fragment = document.importNode(this.templateContent, true)
    fragment.firstElementChild.dataset.cursor = JSON.stringify(cursor)

    let fields = ''
    for (const rule of this.config.collapsedFormatting) {
      let value = entry[rule.field]
      if (value === undefined) {
        continue
      }
      let format: FormatField = {
        original: value,
        current: value,
        classes: [],
        color: null,
        entry: entry,
        tooltip: null,
      }
      for (const transform of rule.transforms) {
        let funcName, data
        if (typeof transform == "string") {
          funcName = transform
          data = {}
        } else {
          funcName = Object.keys(transform)[0]
          data = transform[funcName]
        }
        const tf = transformers[funcName](data)
        format = tf(format)
      }

      if (format.tooltip) {
        format.classes.push("tooltip is-tooltip-bottom")
      }
      const tooltip = format.tooltip ? `data-tooltip="${format.tooltip}"` : ''
      const clazz = format.classes.length > 0 ? 'class="' + format.classes.join(' ') + '"' : ''
      const color = format.color ? `style="color:${format.color}"` : ''

      fields += `<div ${clazz} ${color} ${tooltip}>${format.current}</div>&nbsp;`

      delete (entry[rule.field])
    }

    const snippetEl = fragment.querySelector(".text")
    const buildSnippet = (full: any) => {
      full = this.cleanLog(full)
      for (const rule of this.config.collapsedFormatting) {
        delete (full[rule.field])
      }
      for (const field of this.config.collapsedIgnore) {
        delete (full[field])
      }
      if (Object.keys(full).length > 0) {
        snippetEl.innerHTML = LogFormatter.toLogfmt(full)
      }
    }
    if (origEntry._full) {
      origEntry._full.then(buildSnippet)
    } else {
      buildSnippet(origEntry)
    }

    fragment.querySelector(".fields").innerHTML = fields

    let visible = false
    const expanded = fragment.querySelector(".expanded")
    fragment.querySelector('.unexpanded').addEventListener('click', async () => {
      if (window.getSelection().toString()) {
        // Abort click because user is selecting
        return
      }
      visible = !visible
      if (visible) {
        if (!isExpandedRendered) {
          let full: LogMessage
          if (origEntry._full) {
            full = await origEntry._full
          } else {
            full = origEntry
          }
          // Grab bag of references to use for the copy button, that gets filled in by the
          // rendering code
          const copyBag = []
          expanded.innerHTML = this.renderPrettyJSON(this.cleanLog(full), hrefMaker, copyBag)

          expanded.addEventListener('click', (e) => {
            // Doing some fancy event delegation here since there could be many nested nodes
            const target = e.target as HTMLElement
            if (target.classList.contains('copy-btn')) {
              const data = copyBag[parseInt(target.dataset.copy, 10)]
              let v: string
              if (isObject(data) || Array.isArray(data)) {
                v = JSON.stringify(data, null, 2)
              } else {
                v = data.toString()
              }
              this.copyHelper.copy(v)
              target.dataset.tooltip = "Copied!"
              setTimeout(() => target.dataset.tooltip = "Copy", 1000)
              e.stopPropagation()
            }
          })
          isExpandedRendered = true
        }
        expanded.classList.remove('is-hidden')
      } else {
        expanded.classList.add('is-hidden')
      }
    })
    fragment.querySelector('.expanded').addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      if (target.classList.contains('show-nested')) {
        target.nextElementSibling.classList.remove('is-hidden')
        target.classList.add('is-hidden')
      } else if (target.classList.contains('hide-nested')) {
        target.parentElement.previousElementSibling.classList.remove('is-hidden')
        target.parentElement.classList.add('is-hidden')
      }
    })

    return fragment
  }

  renderPrettyJSON(obj: any, hrefMaker: HrefMaker, copyBag: Array<any>, path: Array<string> = [], level = 0): string {
    const indent = makeIndent(level + 1)
    const lastIndent = makeIndent(level)
    const pathStr = path.join('.')
    if (this.config.expandedFormatting[pathStr] !== undefined) {
      return this.config.expandedFormatting[pathStr]({
        original: obj,
        indent: indent,
        hrefMaker: hrefMaker,
        copyBag: copyBag,
      })
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) {
        return '[]'
      }

      let collapse = path.length !== 0
      let ret = '[' + makeCopyBtn(obj, copyBag)
      obj.forEach((v) => {
        ret += `\n${indent}`
        ret += this.renderPrettyJSON(v, hrefMaker, copyBag, path, level + 1)
      })
      ret += `\n${lastIndent}]`
      if (collapse) {
        ret = nestedCollapseTemplate('[…]', ret)
      }
      return ret
    }

    if (isObject(obj)) {
      const keys = Object.keys(obj).sort()
      if (keys.length == 0) {
        return '{}'
      }
      let collapse = path.length !== 0
      let ret = '{' + makeCopyBtn(obj, copyBag)
      keys.forEach((k) => {
        const v = obj[k]
        ret += `\n${indent}${k}: `
        ret += this.renderPrettyJSON(v, hrefMaker, copyBag, path.concat([k]), level + 1)
      })
      ret += `\n${lastIndent}}`
      if (collapse) {
        ret = nestedCollapseTemplate('{…}', ret)
      }
      return ret
    }

    let v: string
    if (typeof obj === 'string') {
      obj = obj.trimRight()
      if (obj.includes('\n')) {
        v = `\n${indent}` + obj.split('\n').join(`\n${indent}`)
      } else {
        v = obj
      }
    } else {
      v = JSON.stringify(obj)
    }

    if (this.shouldShowLinks(path)) {
      const href = hrefMaker(pathStr + ':' + JSON.stringify(obj))
      v = `<a class="filter-link" href="?${href}">${v}</a>`
    }
    v = `<span class="copyable-wrapper">${v}${makeCopyBtn(obj, copyBag)}</span>`

    return v
  }

  shouldShowLinks(path: Array<string>): boolean {
    const joinedPath = path.join('.')
    if (this.config.maxDepthForLinks == undefined) {
      return true
    }
    if (this.config.maxDepthForLinksExceptions.find(p => joinedPath.startsWith(p))) {
      return true
    }
    return path.length <= this.config.maxDepthForLinks
  }

  static logger(field: FormatField): FormatField {
    if (!/^\w+(\.\w+)+$/.test(field.original)) {
      // Only format Java class names
      return field
    }
    const parts = field.original.split('.')
    field.current = parts
      .map((p, idx) => (p.length > 1 && idx != parts.length - 1) ? p[0] : p)
      .join('.')
    field.tooltip = field.original
    return field
  }

  static toLogfmt(entry: Object): string {
    let parts = []
    const keys = Object.keys(entry).sort()
    for (const k of keys) {
      let v = entry[k]
      if (isObject(v) || Array.isArray(v)) {
        v = JSON.stringify(v)
      }
      if (v.length > 100) {
        // Skip values that are too long. They slow rendering, and won't fit on the screen anyways.
        continue
      }
      parts.push(`${k}=${v}`)
    }
    return parts.join(' ')
  }
}

function timestamp(): Transform {
  return function (input: FormatField): FormatField {
    if (!input.original) {
      return input
    }
    const date = new Date(Date.parse(input.original))

    function pad(number) {
      if (number < 10) {
        return '0' + number
      }
      return number
    }

    // Render date in local time as YYYY-mm-DD HH:MM:ss.SSS
    input.current = date.getFullYear() +
      '-' + pad(date.getMonth() + 1) +
      '-' + pad(date.getDate()) +
      ' ' + pad(date.getHours()) +
      ':' + pad(date.getMinutes()) +
      ':' + pad(date.getSeconds()) +
      '.' + (date.getMilliseconds() / 1000).toFixed(3).slice(2, 5)
    return input
  }
}

function mapValue(mapping: Record<string, string>): Transform {
  return function (input: FormatField) {
    const lookup = mapping[input.current]
    if (lookup !== undefined) {
      input.current = lookup
    }
    return input
  }
}

function mapClass(mapping: Record<string, string>): Transform {
  return function (input: FormatField) {
    const lookup = mapping[input.current]
    if (lookup !== undefined) {
      input.classes.push(lookup)
    }
    return input
  }
}

function addClass(c: string): Transform {
  return function (input: FormatField) {
    input.classes.push(c)
    return input
  }
}

function upperCase(): Transform {
  return function (input: FormatField): FormatField {
    input.current = input.current.toUpperCase()
    return input
  }
}

function randomStableColor(): Transform {
  return function (field: FormatField): FormatField {
    if (!field.original) {
      return field
    }
    const RAINBOW_RANGE = 20
    const idx = xmur3(field.original) % RAINBOW_RANGE
    field.classes.push(`rainbow-${idx}`)
    return field
  }
}

// Random hash algorithm copied from https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript
// to generate a random enough number for colors
function xmur3(str: string): number {
  for (var i = 0, h = 1779033703 ^ str.length; i < str.length; i++)
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353),
      h = h << 13 | h >>> 19
  h = Math.imul(h ^ h >>> 16, 2246822507)
  h = Math.imul(h ^ h >>> 13, 3266489909)
  return (h ^= h >>> 16) >>> 0
}

function isObject(obj: any): boolean {
  return obj === Object(obj)
}

function makeIndent(level: number): string {
  let ret = ''
  for (let i = 0; i < level; i++) {
    ret += '  '
  }
  return ret
}

function nestedCollapseTemplate(placeholder: string, collapsed: string): string {
  return `<span class="show-nested toggle">${placeholder}</span><span class="is-hidden"><span class="hide-nested toggle">[collapse]</span> ${collapsed}</span>`
}

export function makeCopyBtn(v: any, copyBag: Array<any>): string {
  // Save the reference to the value to the next index in the array, and track index in "data-copy"
  copyBag.push(v)
  return `<span class="icon copy-btn tooltip is-tooltip-right" data-tooltip="Copy" data-copy="${copyBag.length - 1}"><i class="mdi mdi-content-copy"></i></span>`
}

export const transformers: { [key: string]: (any) => Transform } = {
  timestamp,
  upperCase,
  mapValue,
  mapClass,
  addClass,
  randomStableColor,
}
