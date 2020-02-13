import { IMoment, InvalidDate, Now, Time } from "./time"
import moment from 'moment'
import { prepareApp } from "./testHelper"

describe("picker", () => {
  beforeAll(() => {
    prepareApp()
  })

  describe("whenAdd", () => {
    test("basic", () => {
      expect(
        Time.whenToText(Time.whenAdd(Time.parseText("2011-01-01T00:00:00Z"), moment.duration(1, "h")))
      ).toEqual(
        Time.whenToText(Time.parseText("2011-01-01T01:00:00Z"))
      )
    })
  })

  describe("whenToDate", () => {
    test("now", () => {
      expect(Time.whenToDate(Now).getUTCSeconds()).toEqual(new Date().getUTCSeconds())
    })

    test("invalid", () => {
      expect(Time.whenToDate(InvalidDate)).toBeNull()
    })

    test("moment", () => {
      expect(Time.whenToDate(Time.wrapMovement(moment("2050-01-01T12:23:34Z"))))
        .toEqual(new Date("2050-01-01T12:23:34Z"))
    })

    test("wrap", () => {
      let month = new Date().getMonth() - 2
      if (month < 0) {
        month += 12
      }
      expect(Time.whenToDate(Time.wrapRelative(-2, "months")).getMonth())
        .toEqual(month)

      let hour = new Date().getHours() - 2
      if (hour < 0) {
        hour += 24
      }
      expect(Time.whenToDate(Time.wrapRelative(-2, "h")).getHours())
        .toEqual(hour)
    })
  })

  describe("whenToText", () => {
    test("now", () => {
      expect(Time.whenToText(Now)).toEqual("")
    })

    test("now-5d", () => {
      expect(Time.whenToText(Time.wrapRelative(-5, "d"))).toEqual("-5d")
    })
  })

  describe("parseText", () => {
    test("should know about empty values", () => {
      expect(Time.parseText("")).toEqual(Now)
    })

    test("should parse relative values", () => {
      const anHourAgo = {
        kind: "relative",
        count: -1,
        unit: "hour",
      }

      expect(Time.parseText("-1h")).toEqual(anHourAgo)
      expect(Time.parseText("now-1H")).toEqual(anHourAgo)
      expect(Time.parseText("-1 hour")).toEqual(anHourAgo)
      expect(Time.parseText("now-1 HoUr")).toEqual(anHourAgo)
    })

    test("should parse dates", () => {
      expect((Time.parseText("2010-01-01 01:02:03 UTC") as IMoment).moment.toISOString())
        .toEqual("2010-01-01T01:02:03.000Z")
      expect((Time.parseText("2010-01-01 GMT-1") as IMoment).moment.toISOString())
        .toEqual("2010-01-01T01:00:00.000Z")
    })

    test("should inform about invalid dates", () => {
      expect(Time.parseText("ABC")).toEqual(InvalidDate)
      expect(Time.parseText("yesterday")).toEqual(InvalidDate)
    })
  })
})
