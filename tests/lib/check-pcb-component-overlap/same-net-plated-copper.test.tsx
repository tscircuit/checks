import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"

test("same-net test pad partially entering the drill still reports an overlap", async () => {
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
        pcbX={0.5}
        layer="bottom"
        shape="circle"
        radius={0.1}
      />
    </board>,
  )
  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()
  const pad = circuit.db.pcb_smtpad.list()[0]
  const hole = circuit.db.pcb_plated_hole.list()[0]
  expect(
    getFullConnectivityMapFromCircuitJson(circuitJson).areIdsConnected(
      pad.pcb_smtpad_id,
      hole.pcb_plated_hole_id,
    ),
  ).toBe(true)
  const errors = checkPcbComponentOverlap(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_smtpad_ids).toEqual([pad.pcb_smtpad_id])
  expect(errors[0].pcb_plated_hole_ids).toEqual([hole.pcb_plated_hole_id])
})

test("test pad on a different net still reports plated copper contact", async () => {
  const circuit = new Circuit({
    platform: { placementDrcChecksDisabled: true },
  })
  circuit.add(
    <board name="B1" width={5} height={4} routingDisabled>
      <net name="GND" />
      <net name="VCC" />
      <port name="PTH" connectsTo="net.GND" />
      <port name="TP" connectsTo="net.VCC" />
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
    </board>,
  )
  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()
  const pad = circuit.db.pcb_smtpad.list()[0]
  const hole = circuit.db.pcb_plated_hole.list()[0]
  expect(
    getFullConnectivityMapFromCircuitJson(circuitJson).areIdsConnected(
      pad.pcb_smtpad_id,
      hole.pcb_plated_hole_id,
    ),
  ).toBe(false)
  expect(checkPcbComponentOverlap(circuitJson)).toHaveLength(1)
})

test("same-net plated holes still report an overlap", async () => {
  const circuit = new Circuit({
    platform: { placementDrcChecksDisabled: true },
  })
  circuit.add(
    <board name="B1" width={5} height={4} routingDisabled>
      <net name="GND" />
      <port name="PTH1" connectsTo="net.GND" />
      <port name="PTH2" connectsTo="net.GND" />
      <platedhole
        portHints={["PTH1"]}
        shape="circle"
        holeDiameter={0.9}
        outerDiameter={1.8}
      />
      <platedhole
        portHints={["PTH2"]}
        pcbX={0.65}
        shape="circle"
        holeDiameter={0.9}
        outerDiameter={1.8}
      />
    </board>,
  )
  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()
  const [hole1, hole2] = circuit.db.pcb_plated_hole.list()
  expect(
    getFullConnectivityMapFromCircuitJson(circuitJson).areIdsConnected(
      hole1.pcb_plated_hole_id,
      hole2.pcb_plated_hole_id,
    ),
  ).toBe(true)
  expect(checkPcbComponentOverlap(circuitJson)).toHaveLength(1)
})

test("same-net test pad tangent to the drill clears numerical roundoff", async () => {
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
        pcbX={0.55}
        layer="bottom"
        shape="circle"
        radius={0.1}
      />
    </board>,
  )
  await circuit.renderUntilSettled()

  expect(checkPcbComponentOverlap(circuit.getCircuitJson())).toHaveLength(0)
})

test("same-net rectangular test pad can touch plated copper while clearing the drill", async () => {
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
        shape="rect"
        width={0.2}
        height={0.2}
      />
    </board>,
  )
  await circuit.renderUntilSettled()

  expect(checkPcbComponentOverlap(circuit.getCircuitJson())).toHaveLength(0)
})
