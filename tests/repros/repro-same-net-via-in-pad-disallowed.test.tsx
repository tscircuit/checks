import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { checkViasInPads } from "lib/check-vias-in-pads"
import { runAllPlacementChecks, runAllRoutingChecks } from "lib/run-all-checks"
import { Circuit } from "tscircuit"

export default function SameNetViaInPadRepro({
  isViaInPadAllowed = false,
}: {
  isViaInPadAllowed?: boolean
}) {
  return (
    <board
      width={10}
      height={6}
      isViaInPadAllowed={isViaInPadAllowed}
      autorouter={{ allowViaInPad: isViaInPadAllowed }}
    >
      {[-2, 2].map((pcbX, index) => (
        <chip
          key={pcbX}
          name={`U${index + 1}`}
          pcbX={pcbX}
          schX={pcbX}
          pinLabels={{ pin1: "SIG" }}
          footprint={
            <footprint>
              <smtpad portHints={["pin1"]} shape="rect" width={2} height={2} />
              <courtyardrect width={2.4} height={2.4} />
            </footprint>
          }
        />
      ))}
      <trace from=".U1 > .pin1" to="net.SIG" />
      <trace from=".U1 > .pin1" to=".U2 > .pin1" pcbStraightLine />
      <via
        name="V1"
        pcbX={-2}
        pcbY={0}
        fromLayer="top"
        toLayer="bottom"
        outerDiameter={0.6}
        holeDiameter={0.3}
        connectsTo="net.SIG"
      />
      <pcbnotetext
        text="Same-net via inside U1.SIG"
        pcbY={2.3}
        fontSize={0.3}
      />
      <pcbnotetext
        text={
          isViaInPadAllowed ? "Via-in-pad allowed" : "Via-in-pad disallowed"
        }
        pcbY={-2.3}
        fontSize={0.3}
      />
    </board>
  )
}

test("reports a same-net via inside a pad when via-in-pad is disallowed", async () => {
  const circuit = new Circuit()
  circuit.add(<SameNetViaInPadRepro isViaInPadAllowed={false} />)
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()

  const board = circuit.db.pcb_board.list()[0]
  const vias = circuit.db.pcb_via.list()
  const pads = circuit.db.pcb_smtpad.list()
  expect(board.is_via_in_pad_allowed).toBe(false)
  expect(vias).toHaveLength(1)
  expect(pads).toHaveLength(2)
  const via = vias[0]
  const pad = pads[0]
  expect(pad.shape).toBe("rect")
  if (pad.shape !== "rect") throw new Error("Expected a rectangular SMT pad")
  expect(via.x).toBe(pad.x)
  expect(via.y).toBe(pad.y)
  expect(via.outer_diameter).toBeLessThan(pad.width)
  expect(via.outer_diameter).toBeLessThan(pad.height)
  expect(via.layers).toContain(pad.layer)

  const connMap = getFullConnectivityMapFromCircuitJson(circuitJson)
  expect(connMap.areIdsConnected(via.pcb_via_id, pad.pcb_smtpad_id)).toBe(true)

  // Same-net connectivity must not override the board's via-in-pad policy.
  const viaInPadErrors = checkViasInPads(circuitJson)
  const placementErrors = await runAllPlacementChecks(circuitJson)
  const routingErrors = await runAllRoutingChecks(circuitJson)
  expect(viaInPadErrors).toHaveLength(1)
  expect(placementErrors).toHaveLength(1)
  expect(viaInPadErrors).toMatchInlineSnapshot(`
    [
      {
        "error_type": "pcb_placement_error",
        "message": "Via copper at (-2.00mm, 0.00mm) overlaps SMD pad U1.SIG at (-2.00mm, 0.00mm)",
        "pcb_placement_error_id": "via_in_pad_pcb_via_0_pcb_smtpad_0",
        "subcircuit_id": "subcircuit_source_group_0",
        "type": "pcb_placement_error",
      },
    ]
  `)
  expect(placementErrors).toMatchInlineSnapshot(`
    [
      {
        "error_type": "pcb_placement_error",
        "message": "Via copper at (-2.00mm, 0.00mm) overlaps SMD pad U1.SIG at (-2.00mm, 0.00mm)",
        "pcb_placement_error_id": "via_in_pad_pcb_via_0_pcb_smtpad_0",
        "subcircuit_id": "subcircuit_source_group_0",
        "type": "pcb_placement_error",
      },
    ]
  `)
  expect(routingErrors).toMatchInlineSnapshot(`[]`)

  await expect(
    convertCircuitJsonToPcbSvg(
      [...circuitJson, ...placementErrors, ...routingErrors],
      { shouldDrawErrors: true, showErrorsInTextOverlay: true },
    ),
  ).toMatchSvgSnapshot(import.meta.path)
})

test("allows a same-net via inside a pad when via-in-pad is enabled", async () => {
  const circuit = new Circuit()
  circuit.add(<SameNetViaInPadRepro isViaInPadAllowed={true} />)
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()

  const board = circuit.db.pcb_board.list()[0]
  const vias = circuit.db.pcb_via.list()
  const pads = circuit.db.pcb_smtpad.list()
  expect(board.is_via_in_pad_allowed).toBe(true)
  expect(vias).toHaveLength(1)
  expect(pads).toHaveLength(2)
  const via = vias[0]
  const pad = pads[0]
  expect(pad.shape).toBe("rect")
  if (pad.shape !== "rect") throw new Error("Expected a rectangular SMT pad")
  expect(via.x).toBe(pad.x)
  expect(via.y).toBe(pad.y)
  expect(via.outer_diameter).toBeLessThan(pad.width)
  expect(via.outer_diameter).toBeLessThan(pad.height)
  expect(via.layers).toContain(pad.layer)

  const connMap = getFullConnectivityMapFromCircuitJson(circuitJson)
  expect(connMap.areIdsConnected(via.pcb_via_id, pad.pcb_smtpad_id)).toBe(true)

  const viaInPadErrors = checkViasInPads(circuitJson)
  const placementErrors = await runAllPlacementChecks(circuitJson)
  const routingErrors = await runAllRoutingChecks(circuitJson)
  expect(viaInPadErrors).toMatchInlineSnapshot(`[]`)
  expect(placementErrors).toMatchInlineSnapshot(`[]`)
  expect(routingErrors).toMatchInlineSnapshot(`[]`)

  await expect(
    convertCircuitJsonToPcbSvg(
      [...circuitJson, ...placementErrors, ...routingErrors],
      { shouldDrawErrors: true, showErrorsInTextOverlay: true },
    ),
  ).toMatchSvgSnapshot(import.meta.path, "same-net-via-in-pad-allowed")
})
