import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import { runAllRoutingChecks } from "../../lib/run-all-checks"

test("routing checks accept a rect-pad plated hole whose offsets are undefined", async () => {
  // core inserts `hole_offset_x: props.holeOffsetX`, so an unset offset is a
  // present key holding undefined (dropped only when the JSON is serialized)
  const circuit = new Circuit({ platform: { routingDrcChecksDisabled: true } })
  circuit.add(
    <board width="20mm" height="20mm">
      <chip
        name="J1"
        pcbX={0}
        pcbY={0}
        footprint={
          <footprint>
            <platedhole
              portHints={["1"]}
              pcbX={0}
              pcbY={0}
              shape="circular_hole_with_rect_pad"
              holeDiameter={0.92}
              rectPadWidth={1.5}
              rectPadHeight={1.5}
            />
          </footprint>
        }
      />
      <resistor name="R1" resistance="1k" footprint="0402" pcbX={0} pcbY={-6} />
      <trace from=".J1 > .pin1" to=".R1 > .pin1" />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson() as any[]
  const hole = circuitJson.find(
    (e) =>
      e.type === "pcb_plated_hole" && e.shape === "circular_hole_with_rect_pad",
  )
  hole.hole_offset_x = undefined
  hole.hole_offset_y = undefined

  const errors = await runAllRoutingChecks(circuitJson as any)
  expect(errors.some((e: any) => /Illegal Parameters/.test(e.message))).toBe(
    false,
  )
})
