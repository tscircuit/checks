import { expect, test } from "bun:test"
import { getLayersOfPcbElement } from "lib/util/getLayersOfPcbElement"

test("plated spans include every physical layer between their endpoints", () => {
  const throughVia = {
    type: "pcb_via",
    layers: ["top", "bottom"],
  } as any
  const reversedThroughVia = {
    type: "pcb_via",
    layers: ["bottom", "top"],
  } as any
  const blindVia = {
    type: "pcb_via",
    layers: ["top", "inner1"],
  } as any
  const buriedVia = {
    type: "pcb_via",
    layers: ["inner1", "inner2"],
  } as any
  const throughHole = {
    type: "pcb_plated_hole",
    layers: ["top", "bottom"],
  } as any

  expect(getLayersOfPcbElement(throughVia, 4)).toEqual([
    "top",
    "inner1",
    "inner2",
    "bottom",
  ])
  expect(getLayersOfPcbElement(reversedThroughVia, 4)).toEqual([
    "top",
    "inner1",
    "inner2",
    "bottom",
  ])
  expect(getLayersOfPcbElement(blindVia, 4)).toEqual(["top", "inner1"])
  expect(getLayersOfPcbElement(buriedVia, 4)).toEqual(["inner1", "inner2"])
  expect(getLayersOfPcbElement(throughHole, 4)).toEqual([
    "top",
    "inner1",
    "inner2",
    "bottom",
  ])
  expect(getLayersOfPcbElement(throughVia)).toContain("inner8")
})
