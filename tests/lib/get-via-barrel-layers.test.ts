import { expect, test } from "bun:test"
import type { LayerRef, PcbVia } from "circuit-json"
import { getViaBarrelLayers } from "lib/util/get-via-barrel-layers"

const FOUR_LAYER_STACK = ["top", "inner1", "inner2", "bottom"]

const via = (layers: LayerRef[]): PcbVia => ({
  type: "pcb_via",
  pcb_via_id: "via",
  x: 0,
  y: 0,
  hole_diameter: 0.3,
  outer_diameter: 0.6,
  layers,
})

test("a through via reaches the layers its record leaves out", () => {
  expect(getViaBarrelLayers(via(["top", "bottom"]), FOUR_LAYER_STACK)).toEqual(
    FOUR_LAYER_STACK,
  )
  expect(getViaBarrelLayers(via(["bottom", "top"]), FOUR_LAYER_STACK)).toEqual(
    FOUR_LAYER_STACK,
  )
})

test("blind and buried spans keep their limits", () => {
  expect(getViaBarrelLayers(via(["top", "inner1"]), FOUR_LAYER_STACK)).toEqual([
    "top",
    "inner1",
  ])
  expect(
    getViaBarrelLayers(via(["inner1", "inner2"]), FOUR_LAYER_STACK),
  ).toEqual(["inner1", "inner2"])
  expect(getViaBarrelLayers(via(["top"]), FOUR_LAYER_STACK)).toEqual(["top"])
})

test("a 2-layer through via is unchanged", () => {
  expect(getViaBarrelLayers(via(["top", "bottom"]), ["top", "bottom"])).toEqual(
    ["top", "bottom"],
  )
})

test("layers outside the board stack stay as listed", () => {
  expect(getViaBarrelLayers(via(["top", "inner3"]), FOUR_LAYER_STACK)).toEqual([
    "top",
    "inner3",
  ])
})
