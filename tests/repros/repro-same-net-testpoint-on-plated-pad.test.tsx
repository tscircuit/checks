import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"

test("same-net testpoint on plated copper clears the drill without an overlap error", async () => {
  const circuit = new Circuit({
    platform: { placementDrcChecksDisabled: true },
  })
  circuit.add(
    <board name="B1" width={5} height={4} routingDisabled>
      <net name="GND" />
      <port name="PTH" connectsTo="net.GND" />
      <port name="TP" connectsTo="net.GND" />
      <platedhole
        portHints={["PTH"]}
        shape="circle"
        holeDiameter={0.9}
        outerDiameter={1.8}
      />
      <smtpad
        portHints={["TP"]}
        pcbX={0.65}
        layer="bottom"
        shape="circle"
        radius={0.1}
      />
      <pcbnotetext text="GND: plated hole" pcbY={1.4} fontSize={0.25} />
      <pcbnotetext
        text="GND: bottom test pad on copper ring"
        pcbY={-1.4}
        fontSize={0.18}
      />
    </board>,
  )
  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()
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
    connectivity.areAllIdsConnected([
      pad.pcb_smtpad_id,
      hole.pcb_plated_hole_id,
      circuit.db.source_net.list()[0].source_net_id,
    ]),
  ).toBe(true)

  const errors = checkPcbComponentOverlap(circuitJson)
  expect(errors).toHaveLength(0)
  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      layer: "bottom",
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
