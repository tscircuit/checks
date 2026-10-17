import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { checkCopperPourDeadEndFingers } from "../../index"
import { net, pour, check } from "../fixtures/copper-pour-dead-end-fingers"

test("reports one nonfatal diagnostic per finger with readable net, layer and position", () => {
  const errors = check(pour())
  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    type: "pcb_placement_error",
    is_fatal: false,
    pcb_placement_error_id: "copper_pour_dead_end_finger_pcb_copper_pour_1_0",
  })
  expect(errors[0].message).toContain("GND")
  expect(errors[0].message).toContain("on top")
  expect(errors[0].message).toContain("10.00mm")
  expect(errors[0].message).not.toContain("source_net_1")
  expect(errors[0].message).not.toContain("pcb_copper_pour_1")
  const unnamed = checkCopperPourDeadEndFingers([
    { ...pour(), source_net_id: undefined },
  ] as AnyCircuitElement[])
  expect(unnamed[0].message).toContain("unnamed copper pour")
  expect(unnamed[0].message).not.toContain("pcb_copper_pour_1")
})
