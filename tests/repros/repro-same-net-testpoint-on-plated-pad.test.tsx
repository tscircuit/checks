import { expect, test } from "bun:test"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"
import { Circuit } from "tscircuit"
import { normalizeFixtureSourcePorts } from "../fixtures/normalize-fixture-source-ports"

test("repro: same-net testpoint on plated copper reports a footprint overlap", async () => {
  const circuit = new Circuit({
    platform: { placementDrcChecksDisabled: true },
  })
  circuit.add(
    <board width={5} height={4} routingDisabled>
      <net name="GND" />
      <chip
        name="J1"
        pinLabels={{ pin1: "GND" }}
        connections={{ pin1: "net.GND" }}
        footprint={
          <footprint>
            <platedhole
              portHints={["pin1"]}
              shape="circle"
              holeDiameter={0.9}
              outerDiameter={1.8}
            />
          </footprint>
        }
      />
      <chip
        name="TP1"
        pcbX={0.65}
        pinLabels={{ pin1: "GND" }}
        connections={{ pin1: "net.GND" }}
        doNotPlace
        obstructsWithinBounds={false}
        footprint={
          <footprint>
            <smtpad
              portHints={["pin1"]}
              layer="bottom"
              shape="circle"
              radius={0.1}
            />
          </footprint>
        }
      />
      <pcbnotetext text="J1.GND: plated hole" pcbY={1.4} fontSize={0.25} />
      <pcbnotetext
        text="TP1.GND: bottom test pad on copper ring"
        pcbY={-1.4}
        fontSize={0.18}
      />
    </board>,
  )
  await circuit.renderUntilSettled()

  const circuitJson = normalizeFixtureSourcePorts(circuit.getCircuitJson())
  const pad = circuit.db.pcb_smtpad.list()[0]
  const hole = circuit.db.pcb_plated_hole.list()[0]
  expect(pad).toMatchObject({
    shape: "circle",
    layer: "bottom",
    x: 0.65,
    y: 0,
    radius: 0.1,
  })
  expect(hole).toMatchObject({
    x: 0,
    y: 0,
    hole_diameter: 0.9,
    outer_diameter: 1.8,
  })
  const connectivity = getFullConnectivityMapFromCircuitJson(circuitJson)
  expect(
    connectivity.areIdsConnected(pad.pcb_smtpad_id, hole.pcb_plated_hole_id),
  ).toBe(true)

  const errors = checkPcbComponentOverlap(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_smtpad_ids).toEqual([pad.pcb_smtpad_id])
  expect(errors[0].pcb_plated_hole_ids).toEqual([hole.pcb_plated_hole_id])
  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      layer: "bottom",
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
