import {Query} from "./Query"
import {Bucket, HistogramResults, IDataSource} from "../backends/elasticsearch/Elasticsearch"
import {IRelative, Time, When} from "../helpers/Time"
import {Direction, TimeZone} from "./Prefs"
import moment, {Moment, unitOfTime} from 'moment'
import * as d3 from 'd3'

interface Size {
  width: number
  height: number
}

interface BucketInfo {
  bucket: Bucket
  hovering: boolean
  date?: Date
  x: number
  y: number
}

export class Histogram {
  private margin = {
    left: 60,
    right: 30,
    top: 40,
    bottom: 40,
  }
  private heightPerTick = 20
  private skipTickLabels = 4
  private es: IDataSource
  private svg: any
  private g: any
  private svgSize: Size
  private innerSize: Size
  private chart: any
  private valueAxis: any
  private timeAxis: any
  private query: Query
  private buckets: BucketInfo[]
  private direction: Direction
  private scaleTime: any
  private valueScale: any
  private scaleBand: any
  private visibleRange: any
  private dragRange: any
  private visible: [Date, Date]
  private downloaded: [Date, Date]
  private drag: [Date, Date]
  private downloadedRange: any
  private tooltip: any
  private hoveringBucket: BucketInfo
  private callback: (q: Query) => void
  private interval: IRelative
  private isDragging: boolean
  private tz: TimeZone

  constructor(es: IDataSource, direction: Direction, tz: TimeZone) {
    this.es = es
    this.direction = direction
    this.tz = tz
  }

  setDataSource(ds: IDataSource) {
    this.es = ds
  }

  setCallback(f: (q: Query) => void) {
    this.callback = f
    return this
  }

  updatedQuery(q: Query) {
    this.callback(q)

    // This temporarily zooms in with the course data available until the fine data comes in, but the bars overflow past the extends, which is not too bad really.
    this.setVisibleRange([Time.whenToDate(this.query.startTime), Time.whenToDate(this.query.endTime)])
    this.updateTimeAxis()
    this.updateChart()
  }

  setQuery(q: Query) {
    this.query = q
  }

  setDirection(direction: Direction) {
    this.direction = direction
    if (this.query !== undefined) {
      this.redraw()
    }
  }

  setTimeZone(tz: TimeZone) {
    this.tz = tz
  }

  setVisibleRange(range: [Date, Date]) {
    this.visible = range
    this.updateVisibleRange()
  }

  setDownloadedRange(range: [Date, Date]) {
    this.downloaded = range
    this.updateDownloadedRange()
  }

  async search(query: Query) {
    this.calculateSizes()
    const when = this.calculateBucketSize(query)
    this.interval = when.kind === "relative" && when as IRelative
    this.update(query, await this.es.histogram(query, this.interval, Intl.DateTimeFormat().resolvedOptions().timeZone))
  }

  attach(svg: SVGElement) {
    this.svg = d3.select(svg)
    this.g = this.svg.append("g")
    this.downloadedRange = this.g.append("g").append("rect").attr('class', 'downloaded-range')
    this.visibleRange = this.g.append("g").append("rect").attr('class', 'visible-range')
    this.dragRange = this.g.append("g").append("rect").attr('class', 'drag-range')
    this.chart = this.g.append("g")
    this.chart = this.g.append("g")
    this.valueAxis = this.g.append("g")
    this.timeAxis = this.g.append("g")
    this.tooltip = d3.select("#histogram-tooltip")
    this.attachMouseEvents()
    this.attachResizeEvents()
  }

  clear() {
    this.buckets = []
    this.updateChart()
  }

  calculateBucketSize(query: Query): When {
    const targetBuckets = this.innerSize.height / this.heightPerTick
    const ms = Time.diff(query.startTime, query.endTime).asMilliseconds()
    const msPerBucket = ms / targetBuckets
    const durations = [
      [1, "ms"],
      [10, "ms"],
      [100, "ms"],
      [500, "ms"],
      [1, "s"],
      [10, "s"],
      [30, "s"],
      [1, "m"],
      [2, "m"],
      [5, "m"],
      [15, "m"],
      [30, "m"],
      [1, "h"],
      [2, "h"],
      [4, "h"],
      [8, "h"],
      [12, "h"],
      [1, "d"],
      [2, "d"],
      [7, "d"],
      [14, "d"],
      [1, "M"],
      [2, "M"],
      [3, "M"],
      [1, "y"],
    ]
      // Apply the absolute millisecond difference to the expected bucket duration.
      .map(i => {
        const dur = moment.duration(i[0], i[1] as moment.unitOfTime.Base).asMilliseconds()
        return [i[0], i[1], Math.abs(msPerBucket - dur)]
      })
      // Sort by smallest delta
      .sort((a, b) => (a[2] > b[2]) ? 1 : -1)

    return Time.wrapRelative(durations[0][0] as number, durations[0][1] as unitOfTime.Base)
  }

  update(query: Query, results: HistogramResults) {
    this.query = query
    this.buckets = results.buckets.map(b => ({
      bucket: b,
      hovering: false,
      x: 0,
      y: 0,
    }))
    this.mangleResults()
    this.redraw()
  }

  private redraw() {
    this.updateTimeAxis()
    this.updateValueAxis()
    this.updateChart()
    this.updateDownloadedRange()
    this.updateVisibleRange()
    this.updateDragRange()
  }

  private calculateSizes() {
    const rect = this.svg.node().getBoundingClientRect()
    this.svgSize = {
      width: rect.width,
      height: rect.height,
    }
    this.innerSize = {
      width: this.svgSize.width - this.margin.left - this.margin.right,
      height: this.svgSize.height - this.margin.top - this.margin.bottom,
    }
  }

  private updateTimeAxis() {
    this.scaleTime = (this.tz === TimeZone.UTC) ? d3.scaleUtc() : d3.scaleTime()
    this.scaleTime.domain([this.query.startTime, this.query.endTime].map(Time.whenToDate)).nice()

    if (this.direction === Direction.Down) {
      this.scaleTime.range([0, this.innerSize.height])
    } else {
      this.scaleTime.range([this.innerSize.height, 0])
    }
    const labels = d3
      .axisLeft(this.scaleTime.interpolate(d3.interpolateRound))
      .ticks(this.innerSize.height / this.heightPerTick / this.skipTickLabels)
    this.timeAxis
      .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`)
      .call(labels)

    let start: Moment
    let end: Moment
    if (this.buckets.length > 0) {
      start = moment(this.buckets[0].date)
      // Add an extra interval to the end for the last bar, so it doesn't overlap past the end.
      end = Time.whenToMoment(Time.whenAdd(
        this.buckets[this.buckets.length - 1].bucket.when,
        Time.whenToDuration(this.interval)
      ))
    } else {
      start = Time.whenToMoment(this.query.startTime)
      end = Time.whenToMoment(this.query.endTime)
    }

    if (this.tz === TimeZone.UTC) {
      start = start.utc()
      end = end.utc()
    }

    this.scaleBand = d3.scaleBand()
      .domain(this.buckets.map(b => b.date.toISOString()))
      .range([
        this.scaleTime(start),
        this.scaleTime(end),
      ])
  }

  private updateValueAxis() {
    this.valueScale = d3.scaleLinear()
      .domain([0, d3.max(this.buckets, d => d.bucket.count)])
      .range([0, this.innerSize.width])
    const labels = d3
      .axisBottom(this.valueScale.interpolate(d3.interpolateRound))
      .ticks(2)
    this.valueAxis
      .attr('transform', `translate(${this.margin.left}, ${this.margin.top + this.innerSize.height})`)
      .call(labels)
  }

  private updateChart() {
    if (this.buckets.length === 0) {
      const c = this.chart
        .selectAll("rect")
        .data(this.buckets)
      c.exit().remove()
      return
    }

    // For some reason d3.scaleBand overlaps bars in millisecond intervals,
    // so we fall back to using d3.scaleTime.
    const isScaleBand = (this.interval.unit !== "millisecond")
    const barStep = (isScaleBand) ?
      this.scaleBand.step() :
      Math.abs(this.scaleTime(this.buckets[0].date.toISOString()) - this.scaleTime(this.buckets[this.buckets.length - 1].date.toISOString())) / this.buckets.length

    const f = el => {
      el.attr('x', this.margin.left)
        .attr('width', d => this.valueScale(d.bucket.count))
        .attr('y', d => {
          const scale = isScaleBand ? this.scaleBand : this.scaleTime
          const y = scale(d.date.toISOString()) + this.margin.top
          d.y = y
          if (this.direction === Direction.Down) {
            d.y += barStep
          }
          return y
        })
        .attr('height', () => {
          if (isScaleBand) {
            return this.scaleBand.bandwidth()
          } else {
            return barStep
          }
        })
        .attr('class', d => d.hovering ? 'hovering' : '')
    }

    const chart = this.chart
      .selectAll("rect")
      .data(this.buckets)
      .call(f)
    chart.enter().append("rect").call(f)
    chart.exit().remove()
  }

  private updateVisibleRange() {
    this.rangeBox(this.visibleRange, this.visible)
  }

  private updateDownloadedRange() {
    this.rangeBox(this.downloadedRange, this.downloaded)
  }

  private updateDragRange() {
    this.rangeBox(this.dragRange, this.drag)
  }

  private rangeBox(el, range?: [Date, Date]) {
    if (range === undefined || this.scaleTime === undefined) {
      el.style('visibility', 'hidden')
      return
    }

    const y0 = this.scaleTime(range[0])
    const y1 = this.scaleTime(range[1])
    const y = (y0 < y1) ? y0 : y1
    const height = Math.abs(y0 - y1)

    el
      .style('visibility', 'visible')
      .attr('x', 0)
      .attr('width', this.svgSize.width)
      .attr('y', this.margin.top + y)
      // +1 to make it at least slightly visible
      .attr('height', height + 1)
  }

  private mangleResults() {
    this.buckets = this.buckets.map(r => ({
      ...r,
      // TODO: Separate bucket from date, maybe a local map.
      date: Time.whenToDate(r.bucket.when),
    }))
  }

  private attachMouseEvents() {
    this.svg
      .on('mousemove', this.mouseMove)
      .on('mouseout', this.hideTooltip)
      .call(d3.drag()
        .on('start', this.dragStart)
        .on('drag', this.dragMove)
        .on('end', this.dragEndOrClick)
      )
  }

  dragStart = () => {
    const [ts] = this.mouseEventInfo()
    this.drag = [ts, ts]
    this.updateDragRange()
    this.isDragging = true

    this.hoverBucket(undefined)
  }

  dragMove = () => {
    const [ts] = this.mouseEventInfo()
    this.drag[1] = ts
    this.updateDragRange()
    this.mouseMove()
  }

  dragEndOrClick = () => {
    this.isDragging = false
    // Check if we just clicked instead of dragged
    const pixelsMoved = Math.abs(this.scaleTime(this.drag[0].getTime()) - this.scaleTime(this.drag[1].getTime()))
    if (pixelsMoved < 3) {
      this.drag = undefined
      this.onClick()
      return
    }

    if (this.drag[0].getTime() > this.drag[1].getTime()) {
      this.drag = [this.drag[1], this.drag[0]]
    }
    this.query.startTime = Time.wrapDate(this.drag[0])
    this.query.endTime = Time.wrapDate(this.drag[1])
    this.drag = undefined
    this.updatedQuery(this.query)
    this.updateDragRange()
  }

  onClick = () => {
    const [, bucket] = this.mouseEventInfo()
    this.hoverBucket(bucket)
    this.query.startTime = this.hoveringBucket.bucket.when
    this.query.endTime = Time.whenAdd(this.hoveringBucket.bucket.when, Time.whenToDuration(this.interval))
    this.updatedQuery(this.query)
  }

  mouseEventInfo(): [Date, BucketInfo] {
    if (this.scaleTime === undefined) {
      return [undefined, undefined]
    }

    const coordinates = d3.mouse(this.svg.node())
    const relY = coordinates[1]
    // 3 is some sort of magic number i don't know where it's coming from
    // It helps align the mouse position to the actual position in the time scale
    const ts = this.scaleTime.invert(relY - this.margin.top - 3)
    const bucket = this.buckets.find(b => {
      const found = b.y > relY
      return this.direction === Direction.Down ? found : !found
    })

    return [ts, bucket]
  }

  mouseMove = () => {
    const height = this.tooltip.node().getBoundingClientRect().height
    const [ts, bucket] = this.mouseEventInfo()
    if (ts === undefined) {
      this.tooltipVisible(false)
      this.hoverBucket(undefined)
      return
    }

    const y = this.scaleTime(ts)
    let text = ''

    if (this.isDragging) {
      let startDate = this.drag[0]
      let endDate = this.drag[1]
      if (this.direction === Direction.Up) {
        [startDate, endDate] = [endDate, startDate]
      }
      if (startDate.getTime() > endDate.getTime()) {
        [startDate, endDate] = [endDate, startDate]
      }

      const start = Time.wrapDate(startDate)
      const end = Time.wrapDate(endDate)
      const diff = Time.diff(start, end)
      const countInBuckets = this.buckets
        .filter(b => b.date.getTime() >= startDate.getTime() && b.date.getTime() <= endDate.getTime())
        .map(b => b.bucket.count)
        .reduce((a, b) => a + b, 0)
      text = this.tooltipText(start, end, diff, countInBuckets)
    } else {
      this.hoverBucket(bucket)

      if (bucket === undefined) {
        this.tooltipVisible(false)
        return
      }

      const duration = Time.whenToDuration(this.interval)
      text = this.tooltipText(this.hoveringBucket.bucket.when, Time.whenAdd(this.hoveringBucket.bucket.when, duration), duration, this.hoveringBucket.bucket.count)
    }

    this.tooltipVisible(true)
    this.tooltip
      .style("top", `${y - height / 2 + this.margin.top}px`)
      .html(text)
  }

  formatDate(when: When): string {
    if (when.kind !== "moment") {
      return Time.whenToText(when)
    }

    const m = (this.tz === TimeZone.UTC) ? when.moment.utc() : when.moment
    return m.format("YYYY-MM-DD HH:mm:ss.SSSZZ")
  }

  tooltipText(start: When, end: When, duration: moment.Duration, count: number): string {
    return `
    ${this.formatDate(start)}<br/>
    ${this.formatDate(end)}<br/>
    ${Time.getRangeHuman(duration, 2)} <b>${nFormatter(count, 2)}</b>
    `
  }

  private hoverBucket(bucket: BucketInfo) {
    if (this.hoveringBucket === bucket) {
      return
    }
    if (this.hoveringBucket !== undefined) {
      // TODO: Move this out of Bucket into its own type, similar to "date".
      this.hoveringBucket.hovering = false
    }
    if (bucket !== undefined) {
      bucket.hovering = true
    }
    this.hoveringBucket = bucket
    this.updateChart()
  }

  hideTooltip = () => {
    this.tooltipVisible(false)
  }

  tooltipVisible(visible: boolean) {
    this.tooltip.style("display", visible ? "block" : "none")
  }

  // A resize basically needs to recalculate sizes and request new buckets.
  // We don't want to spam many of them so do a debounce.
  attachResizeEvents() {
    const f = () => {
      if (!this.query) {
        return
      }
      this.search(this.query)
    }
    let timer: NodeJS.Timeout
    window.addEventListener('resize', () => {
      clearTimeout(timer)
      timer = setTimeout(f, 500)
    })
  }
}

// https://stackoverflow.com/a/9462382/11125
// Modified to keep the fixed amount of digits, except when under 1k
function nFormatter(num, digits) {
  const si = [
    {value: 1, symbol: ""},
    {value: 1E3, symbol: "k"},
    {value: 1E6, symbol: "M"},
    {value: 1E9, symbol: "G"},
    {value: 1E12, symbol: "T"},
    {value: 1E15, symbol: "P"},
    {value: 1E18, symbol: "E"}
  ]
  let i
  for (i = si.length - 1; i > 0; i--) {
    if (num >= si[i].value) {
      break
    }
  }
  if (i === 0) {
    digits = 0
  }
  return (num / si[i].value).toFixed(digits) + si[i].symbol
}