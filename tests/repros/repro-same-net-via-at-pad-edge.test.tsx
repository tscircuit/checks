import { normalizeFixtureSourcePorts } from "../fixtures/normalize-fixture-source-ports"
import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { checkViasInPads } from "lib/check-vias-in-pads"
import { runAllPlacementChecks } from "lib/run-all-checks"
import { checkViaPadClearance } from "lib/check-via-pad-clearance"
import { Circuit } from "tscircuit"
import { Fragment } from "react"

const edgeCases = [
  { label: "Via enclosed", offsetX: 0.7 },
  { label: "Hole enclosed", offsetX: 0.85 },
  { label: "Center on edge", offsetX: 1 },
  { label: "Hole crosses edge", offsetX: 1.1 },
  { label: "Hole touches edge", offsetX: 1.15 },
  { label: "Copper overlap only", offsetX: 1.2 },
  { label: "Copper touches edge", offsetX: 1.3 },
  { label: "Clear of pad", offsetX: 1.35 },
]

export default function SameNetViaAtPadEdgeRepro() {
  return (
    <board
      width={24}
      height={11}
      routingDisabled
      isViaInPadAllowed={false}
      autorouter={{ allowViaInPad: false }}
    >
      {edgeCases.map(({ label, offsetX }, index) => {
        const pcbX = (index % 4) * 6 - 9
        const pcbY = index < 4 ? 2.5 : -2.5
        const chipName = `U${index + 1}`
        const netName = `SIG${index + 1}`
        return (
          <Fragment key={chipName}>
            <chip
              name={chipName}
              pcbX={pcbX}
              pcbY={pcbY}
              pinLabels={{ pin1: netName }}
              footprint={
                <footprint>
                  <smtpad
                    portHints={["pin1"]}
                    shape="rect"
                    width={2}
                    height={2}
                  />
                  <courtyardrect width={2.4} height={2.4} />
                </footprint>
              }
            />
            <trace from={`.${chipName} > .pin1`} to={`net.${netName}`} />
            <via
              name={`V${index + 1}`}
              pcbX={pcbX + offsetX}
              pcbY={pcbY}
              fromLayer="top"
              toLayer="bottom"
              outerDiameter={0.6}
              holeDiameter={0.3}
              connectsTo={`net.${netName}`}
            />
            <pcbnotetext
              text={label}
              pcbX={pcbX}
              pcbY={pcbY + 1.7}
              fontSize={0.3}
            />
            <pcbnotetext
              text={`Via center: ${offsetX}mm from pad center`}
              pcbX={pcbX}
              pcbY={pcbY - 1.7}
              fontSize={0.2}
            />
          </Fragment>
        )
      })}
      <pcbnotetext
        text="Same-net vias | via-in-pad disallowed | pad 2mm, copper 0.6mm, drill 0.3mm"
        pcbY={0}
        fontSize={0.25}
      />
    </board>
  )
}

test("same-net vias at the pad edge distinguish the drill from the copper ring", async () => {
  const circuit = new Circuit()
  circuit.add(<SameNetViaAtPadEdgeRepro />)
  await circuit.renderUntilSettled()
  const circuitJson = normalizeFixtureSourcePorts(circuit.getCircuitJson())
  const vias = circuit.db.pcb_via.list()
  const pads = circuit.db.pcb_smtpad.list()
  expect(circuit.db.pcb_board.list()[0].is_via_in_pad_allowed).toBe(false)
  expect(vias).toHaveLength(edgeCases.length)
  expect(pads).toHaveLength(edgeCases.length)
  const connMap = getFullConnectivityMapFromCircuitJson(circuitJson)
  for (const [index, via] of vias.entries()) {
    const pad = pads[index]
    if (pad.shape !== "rect") throw new Error("Expected a rectangular SMT pad")
    expect(via.x - pad.x).toBeCloseTo(edgeCases[index].offsetX)
    expect(via.y).toBe(pad.y)
    expect(connMap.areIdsConnected(via.pcb_via_id, pad.pcb_smtpad_id)).toBe(
      true,
    )
  }

  const errors = checkViasInPads(circuitJson)
  expect(
    errors.map((error) => error.pcb_placement_error_id),
  ).toMatchInlineSnapshot(`
    [
      "via_in_pad_pcb_via_0_pcb_smtpad_0",
      "via_in_pad_pcb_via_1_pcb_smtpad_1",
      "via_in_pad_pcb_via_2_pcb_smtpad_2",
      "via_in_pad_pcb_via_3_pcb_smtpad_3",
    ]
  `)
  expect(await runAllPlacementChecks(circuitJson)).toEqual(errors)
  // These unrouted examples isolate via/pad geometry. Same-net copper
  // contact is allowed by the separate clearance rule in every position.
  expect(checkViaPadClearance(circuitJson)).toMatchInlineSnapshot(`[]`)
  await expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
