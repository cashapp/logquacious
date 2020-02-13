import { LogMessage } from "../backends/elasticsearch"
import { CopyHelper } from "../helpers/copyHelper"
import { escape } from "he"
import { Query } from "./query"
import { Filter } from "../components/app"
import moment from "moment"

export type FieldsConfig = {
  timestamp?: string
  collapsedFormatting: ILogRule[]
  expandedFormatting?: ILogRule[]
  collapsedIgnore?: string[]
  contextFilters?: ContextFilter[]

  // Don't create links for values beneath this depth, for when you don't index this deep.
  maxDepthForLinks?: number

  // Always create links for these fields by prefix. Recommended for them to be indexed.
  maxDepthForLinksExceptions?: string[]

  elasticsearch?: {
    // Fields to search when a user does not specify a field
    queryStringFields?: string[]
  }
}

export type ContextFilter = {
  title: string
  keep?: string[]
  icon?: string
}

export interface ILogRule {
  field: string
  transforms: string[] | object[]
}

interface CollapsedFormatField {
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

export interface ExpandedFormatField {
  readonly original: any,
  current: string
  readonly indent: string,
  readonly query: () => Query
  copyBag: any[]
}

/**
 * Transform is a function that transforms a log record field for formatting. It
 * returns the transformed field. It may transform its input in-place.
 */
type CollapsedTransform = (input: CollapsedFormatField) => CollapsedFormatField

type ExpandedTransform = (input: ExpandedFormatField) => ExpandedFormatField

export type QueryManipulator = {
  getQuery: () => Query
  changeQuery: (newQuery: Query) => void
  getFilters: () => Filter[]
}

export class LogFormatter {
  private readonly copyHelper: CopyHelper
  private templateContent: DocumentFragment
  private config: FieldsConfig
  private _queryManipulator: QueryManipulator

  constructor(config: FieldsConfig) {
    if (config == undefined) {
      console.warn("fieldsConfig is not set")
      // @ts-ignore
      config = {}
    }
    config.collapsedFormatting = config.collapsedFormatting || []
    config.collapsedIgnore = config.collapsedIgnore || []
    config.expandedFormatting = config.expandedFormatting || []
    this.config = config
    this.copyHelper = new CopyHelper()
  }

  set queryManipulator(qm: QueryManipulator) {
    this._queryManipulator = qm
  }

  setTemplate(templateContent: DocumentFragment) {
    this.templateContent = templateContent
    return this
  }

  // Clean a log entry for display.
  private cleanLog(entry: LogMessage): any {
    const out: LogMessage = {...entry}
    delete out.__cursor
    return out
  }

  private safeHTML(entry: any, recursive: boolean): any {
    if (typeof entry == "string") {
      return escape(entry)
    }
    if (!recursive) {
      return entry
    }

    if (Array.isArray(entry)) {
      return entry.map(e => this.safeHTML(e, true))
    }

    entry = {...entry}
    for (const key in entry) {
      entry[key] = this.safeHTML(entry[key], true)
    }
    return entry
  }

  buildSnippet(snippetEl: HTMLElement, full: any) {
    full = this.cleanLog(full)
    full = this.safeHTML(full, true)

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

  build(entry: LogMessage): DocumentFragment {
    const cursor = entry.__cursor
    entry = this.cleanLog(entry)

    // Make shallow copy here before we mangle entry (we only modify top-level fields).
    const origEntry: LogMessage = {...entry}
    // The expanded part is lazily rendered.
    let isExpandedRendered = false

    const fragment = document.importNode(this.templateContent, true)
    const el = fragment.firstElementChild as HTMLElement
    el.dataset.cursor = JSON.stringify(cursor)
    el.dataset.ts = entry[this.config.timestamp]
    el.dataset.id = entry._id

    let fields = ''
    for (const rule of this.config.collapsedFormatting) {
      const value = entry[rule.field]
      if (value === undefined) {
        continue
      }
      let format: CollapsedFormatField = {
        original: value,
        current: value,
        classes: [],
        color: null,
        entry,
        tooltip: null,
      }
      for (const transform of rule.transforms) {
        const {funcName, data} = this.getTransformData(transform)
        const ctf = collapsedTransformers[funcName]
        if (!ctf) {
          throw Error(`Could not find collapsed transformer named '${funcName}'`)
        }
        const tf = ctf(data)
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

    const snippetEl = fragment.querySelector(".text") as HTMLElement
    if (origEntry._full) {
      origEntry._full.then((logMessage) => this.buildSnippet(snippetEl, logMessage))
    } else {
      this.buildSnippet(snippetEl, origEntry)
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
          expanded.innerHTML = this.renderExpandedRecursively(this.cleanLog(full), copyBag, undefined, 0, cursor)

          expanded.addEventListener('click', (e) => {
            // Doing some fancy event delegation here since there could be many nested nodes
            const target = e.target as HTMLElement
            const oldTooltip = target.dataset.tooltip
            const data = copyBag[parseInt(target.dataset.copy, 10)]
            const {getQuery, getFilters, changeQuery} = this._queryManipulator

            const copied = () => {
              target.dataset.tooltip = "Copied!"
              setTimeout(() => target.dataset.tooltip = oldTooltip, 1000)
              e.stopPropagation()
            }

            if (target.classList.contains('copy-button')) {
              let v: string
              if (isObject(data) || Array.isArray(data)) {
                v = JSON.stringify(data, null, 2)
              } else {
                v = data.toString()
              }
              this.copyHelper.copy(v)
              copied()

            } else if (target.classList.contains('link-button')) {
              const sharedQuery = getQuery()
                .withFocus(full._id, JSON.stringify(data))
                .withFixedTimeRange()
              const w = window.location
              this.copyHelper.copy(`${w.protocol}//${w.host}${w.pathname}?${sharedQuery.toURL()}`)
              copied()

            } else if (target.classList.contains('show-context-button')) {
              // We're hijacking the a href when the user left clicks, so that the page doesn't reload.
              // This will also allow middle clicks to new tabs.
              const parent = target.parentNode as HTMLAnchorElement
              changeQuery(Query.load(getFilters(), {urlQuery: parent.href}))
              e.stopPropagation()
              e.preventDefault()

            } else if (target.classList.contains('filter-link')) {
              const anchor = target as HTMLAnchorElement
              changeQuery(Query.load(getFilters(), {urlQuery: anchor.href}))
              e.stopPropagation()
              e.preventDefault()
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

  private getTransformData(transform: string | object) {
    let funcName, data
    if (typeof transform == "string") {
      funcName = transform
      data = {}
    } else {
      funcName = Object.keys(transform)[0]
      data = transform[funcName]
    }
    return {funcName, data}
  }

  renderExpandedRecursively(obj: any, copyBag: any[], path: string[] = [], level = 0, cursor?: any): string {
    const indent = makeIndent(level + 1)
    const lastIndent = makeIndent(level)
    const pathStr = path.join('.')

    obj = this.safeHTML(obj, false)
    let current = obj

    this.config.expandedFormatting.forEach(rule => {
      if (rule.field != pathStr) {
        return undefined
      }

      rule.transforms.forEach(transform => {
        const {funcName, data} = this.getTransformData(transform)
        const func = expandedTransformers[funcName](data)
        const r = func({
          original: obj,
          current,
          indent,
          query: this._queryManipulator.getQuery,
          copyBag,
        })
        current = r.current
      })
    })

    if (current != obj) {
      return current
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) {
        return '[]'
      }

      const collapse = path.length !== 0
      let ret = '[' + copyToClipboardButton(obj, copyBag)
      obj.forEach((v) => {
        ret += `\n${indent}`
        ret += this.renderExpandedRecursively(v, copyBag, path, level + 1)
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
      const collapse = path.length !== 0
      let ret = '{' + copyToClipboardButton(obj, copyBag)

      if (level == 0) {
        ret += linkToClipboardButton(cursor, copyBag)
        ret += this.showContextButtons(cursor, obj)
      }

      keys.forEach((k) => {
        const v = obj[k]
        ret += `\n${indent}${k}: `
        ret += this.renderExpandedRecursively(v, copyBag, path.concat([k]), level + 1)
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
      const query = this._queryManipulator.getQuery().withAddTerms(`${pathStr}:${JSON.stringify(obj)}`)
      v = `<a class="filter-link" href="?${query.toURL()}">${v}</a>`
    }
    v = `<span class="copyable-wrapper">${v}${copyToClipboardButton(obj, copyBag)}</span>`

    return v
  }

  shouldShowLinks(path: string[]): boolean {
    const joinedPath = path.join('.')
    if (this.config.maxDepthForLinks == undefined) {
      return true
    }
    if (this.config.maxDepthForLinksExceptions.find(p => joinedPath.startsWith(p))) {
      return true
    }
    return path.length <= this.config.maxDepthForLinks
  }

  static toLogfmt(entry: Object): string {
    const parts = []
    const keys = Object.keys(entry).sort()
    for (const k of keys) {
      let v = entry[k]
      if (v == null) {
        continue
      }
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

  private showContextButtons(cursor: any, obj: any) {
    if (!this.config.contextFilters) {
      return []
    }
    return this.config.contextFilters.map(f => showContextButton(f, obj, cursor, this._queryManipulator)).join("")
  }
}

function timestamp(): CollapsedTransform {
  return function (input: CollapsedFormatField): CollapsedFormatField {
    if (!input.original) {
      return input
    }
    const date = moment(input.original).toDate()

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

type ReplaceTransform = {
  search: string
  replace: string
}

function replace(rt: ReplaceTransform): CollapsedTransform {
  const re = new RegExp(rt.search)
  return function (input: CollapsedFormatField) {
    input.current = String(input.current).replace(re, rt.replace)
    return input
  }
}

function mapValue(mapping: Record<string, string>): CollapsedTransform {
  return function (input: CollapsedFormatField) {
    const lookup = mapping[input.current]
    if (lookup !== undefined) {
      input.current = lookup
    }
    return input
  }
}

function mapClass(mapping: Record<string, string>): CollapsedTransform {
  return function (input: CollapsedFormatField) {
    const lookup = mapping[input.current]
    if (lookup !== undefined) {
      input.classes.push(lookup)
    }
    return input
  }
}

function addClass(c: string): CollapsedTransform {
  return function (input: CollapsedFormatField) {
    input.classes.push(c)
    return input
  }
}

function upperCase(): CollapsedTransform {
  return function (input: CollapsedFormatField): CollapsedFormatField {
    if (!input?.current) {
      return input
    }
    input.current = input.current.toUpperCase()
    return input
  }
}

function randomStableColor(): CollapsedTransform {
  return function (field: CollapsedFormatField): CollapsedFormatField {
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
  for (let i = 0, h = 1779033703 ^ str.length; i < str.length; i++)
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

export function copyToClipboardButton(v: any, copyBag: any[]): string {
  // Save the reference to the value to the next index in the array, and track index in "data-copy"
  copyBag.push(v)
  return `<a><span class="icon context-button copy-button tooltip is-tooltip-right" data-tooltip="Copy value to clipboard" data-copy="${copyBag.length - 1}"><i class="mdi mdi-content-copy"></i></span></a>`
}

export function linkToClipboardButton(cursor: any, copyBag: any[]): string {
  copyBag.push(cursor)
  return `<a><span class="icon context-button link-button tooltip is-tooltip-right" data-tooltip="Copy sharable link to clipboard" data-copy="${copyBag.length - 1}"><i class="mdi mdi-link"></i></span></a>`
}

// https://stackoverflow.com/a/13218838/11125
// Modified to include elasticsearch "searchable" replacement key
function flatten(obj) {
  const res = {};
  (function recurse(obj, current, currentNonIndexKey) {
    for (const key in obj) {
      // XXX: Sometimes key is an index of an array, rather than a key of an object.
      // XXX: This number will have to be stripped when filtering in ES.
      const value = obj[key]
      const newKey = (current ? current + "." + key : key)  // joined key with dot
      let newNonIndexKey
      if (Array.isArray(obj)) {
        newNonIndexKey = (currentNonIndexKey ? currentNonIndexKey : "")
      } else {
        newNonIndexKey = (currentNonIndexKey ? currentNonIndexKey + `.${key}` : key)
      }

      if (value && typeof value === "object") {
        recurse(value, newKey, newNonIndexKey)  // it's a nested object, so do it again
      } else {
        res[newKey] = {
          value,
          searchableKey: newNonIndexKey,
        }
      }
    }
  })(obj)
  return res
}

export function showContextButton(filter: ContextFilter, obj: any, cursor: any, qm: QueryManipulator): string {
  const flatObj = flatten(obj)

  // Search for key specified in context filter.
  const newTerms = (filter.keep || [])
    .map(k => Object.keys(flatObj).find(field => field.match(new RegExp(k)) ? k : undefined))
    .filter(k => k)
    .map(k => `${flatObj[k].searchableKey}:${JSON.stringify(flatObj[k].value)}`)
    .join(" ")

  // Only create a link when the context field is in the log entry.
  if (!newTerms) {
    return undefined
  }

  const contextQuery = qm.getQuery()
    .withFocus(obj._id, JSON.stringify(cursor))
    .withFixedTimeRange()
    .withAddTerms(newTerms)
  const url = `?${contextQuery.toURL()}`
  const icon = filter.icon || "mdi-filter-variant-remove"
  return `<a href="${url}"><span class="icon context-button show-context-button tooltip is-tooltip-right" data-tooltip="${filter.title}"><i class="mdi ${icon}"></i></span></a>`
}

interface JavaExceptionMatch {
  // If a fqcn has this prefix, it will turn into a link.
  fqcnMatch: string
  // The link generated for a matched fqcn
  href: string
}

interface JavaExceptionConfig {
  matches: JavaExceptionMatch[]
}

function javaException(config: JavaExceptionConfig): ExpandedTransform {
  return (field: ExpandedFormatField): ExpandedFormatField => {
    const indent = field.indent
    const lines = field.current.split('\n')
    const formatted = []
    for (const line of lines) {
      if (!/\s/.test(line[0])) {
        formatted.push(`<span class="has-text-danger">${line}</span>`)
      } else {
        const match = line.match(/^(\s+)at (.*)\((.*?)(:\d+)?\)$/)
        if (!match) {
          formatted.push(line)
          continue
        }
        const [, space, fqcn, file, lineno] = match
        let right = `${fqcn}(${file}${lineno || ""})`
        const exceptionMatch = config.matches.find(m => fqcn.match(new RegExp(m.fqcnMatch)))
        if (exceptionMatch) {
          const parts = fqcn.split('.')
          const firstCapital = parts.findIndex((i: string) => i[0].toLowerCase() !== i[0])
          const path = parts.slice(0, firstCapital).join('/')
          const href = exceptionMatch.href
            .replace("${fqcn}", fqcn)
            .replace("${path}", path)
            .replace("${file}", file)
            .replace("${lineno}", lineno)
          right = `<a target="_blank" class="filter-link" href="${href}">${right}</a>`
        }
        formatted.push(`${space}at ${right}`)
      }
    }
    field.current = `${copyToClipboardButton(field.original, field.copyBag)}\n${indent}` + formatted.join(`\n${indent}`)
    return field
  }
}

function shortenJavaFqcn(): CollapsedTransform {
  return function (field: CollapsedFormatField): CollapsedFormatField {
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
}

export const collapsedTransformers: { [key: string]: (any) => CollapsedTransform } = {
  timestamp,
  upperCase,
  mapValue,
  mapClass,
  addClass,
  replace,
  randomStableColor,
  shortenJavaFqcn,
}

export const expandedTransformers: { [key: string]: (any) => ExpandedTransform } = {
  javaException,
}
