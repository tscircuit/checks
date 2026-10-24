import { expect, test } from "bun:test"
import type { PcbSmtPad, PcbVia } from "circuit-json"
import { checkViaPadClearance } from "lib/check-via-pad-clearance"
import { checkViasInPads } from "lib/check-vias-in-pads"
import { runAllChecks, runAllPlacementChecks } from "lib/run-all-checks"
import {
  issueCornerPad,
  issueCornerVia,
  makeBoard,
  makeKnownNetCircuit,
} from "./check-vias-in-pads-fixtures"

const angle = (37 * Math.PI) / 180
const rotate = ({ x, y }: { x: number; y: number }) => ({
  x: x * Math.cos(angle) - y * Math.sin(angle),
  y: x * Math.sin(angle) + y * Math.cos(angle),
})

const cases: Array<{
  name: string
  pad?: PcbSmtPad
  via?: PcbVia
  sameNet?: boolean
  allowViaInPad?: boolean
  errors: number
}> = [
  { name: "different-net corner overlap", errors: 1 },
  {
    name: "same-net copper contact with drill outside",
    sameNet: true,
    errors: 0,
  },
  {
    name: "separated copper below minimum clearance",
    via: { ...issueCornerVia, y: -1.575 },
    errors: 1,
  },
  {
    name: "copper beyond minimum clearance",
    via: { ...issueCornerVia, x: 1.2 },
    errors: 0,
  },
  {
    name: "rotated pad corner overlap",
    pad: {
      ...issueCornerPad,
      ...rotate(issueCornerPad),
      shape: "rotated_rect",
      width: 0.95,
      height: 0.8,
      ccw_rotation: 37,
    },
    via: { ...issueCornerVia, ...rotate(issueCornerVia) },
    errors: 1,
  },
  {
    name: "no common copper layer",
    via: { ...issueCornerVia, layers: ["inner2", "bottom"] },
    errors: 0,
  },
  {
    name: "via-in-pad allowance still rejects different-net copper overlap",
    allowViaInPad: true,
    errors: 1,
  },
]

test.each(cases)("via-to-pad placement: $name", async (scenario) => {
  const circuitJson = makeKnownNetCircuit({
    pad: scenario.pad ?? issueCornerPad,
    via: scenario.via ?? issueCornerVia,
    padNetId: "SIG",
    viaNetId: scenario.sameNet ? "SIG" : "GND",
  })
  circuitJson[0] = makeBoard(scenario.allowViaInPad)

  // These fixtures isolate annular copper contact/clearance from drill intrusion.
  expect(checkViasInPads(circuitJson)).toEqual([])
  const placementErrors = await runAllPlacementChecks(circuitJson)
  expect(placementErrors).toHaveLength(scenario.errors)
  expect(placementErrors).toEqual(checkViaPadClearance(circuitJson))
  if (scenario.errors) {
    expect(placementErrors[0]).toMatchObject({
      type: "pcb_pad_pad_clearance_error",
      pcb_pad_ids: [issueCornerVia.pcb_via_id, issueCornerPad.pcb_smtpad_id],
    })
    expect(placementErrors[0].message).toContain("unnamed via")
    expect(placementErrors[0].message).not.toContain("pcb_via_1")
    expect(placementErrors[0].message).not.toContain("pcb_smtpad_1")
  }
})

test("runAllChecks reports a via-pad conflict only once", async () => {
  const circuitJson = makeKnownNetCircuit({
    pad: issueCornerPad,
    via: issueCornerVia,
    padNetId: "SIG",
    viaNetId: "GND",
  })
  const errors = await runAllChecks(circuitJson)
  const viaPadErrors = errors.filter(
    (error) =>
      error.type === "pcb_pad_pad_clearance_error" &&
      error.pcb_pad_ids.includes(issueCornerVia.pcb_via_id),
  )
  expect(viaPadErrors).toEqual(checkViaPadClearance(circuitJson))
  expect(viaPadErrors).toHaveLength(1)
})

test("placement uses readable names for a named via and pad", async () => {
  const circuitJson = makeKnownNetCircuit({
    pad: issueCornerPad,
    via: { ...issueCornerVia, name: "V_GND" } as PcbVia,
    padNetId: "SIG",
    viaNetId: "GND",
  })
  const errors = await runAllPlacementChecks(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain("Via V_GND and pad PAD")
  expect(errors[0].message).not.toContain("pcb_via_1")
  expect(errors[0].message).not.toContain("pcb_smtpad_1")
})

test("runAllChecks keeps distinct via-pad conflicts when deduplicating", async () => {
  const circuitJson = makeKnownNetCircuit({
    pad: issueCornerPad,
    via: issueCornerVia,
    padNetId: "SIG",
    viaNetId: "GND",
  })
  circuitJson.push({
    ...issueCornerVia,
    pcb_via_id: "pcb_via_2",
    x: -issueCornerVia.x,
    source_net_id: "GND",
  })
  const errors = await runAllChecks(circuitJson)
  const clearanceErrors = errors.filter(
    (error) => error.type === "pcb_pad_pad_clearance_error",
  )
  expect(clearanceErrors).toHaveLength(2)
  expect(clearanceErrors).toEqual(checkViaPadClearance(circuitJson))
})
