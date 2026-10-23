import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { canSameNetPadsOverlap } from "lib/check-pcb-components-overlap/can-same-net-pads-overlap"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"

test("oval plated pads allow same-net copper contact but reject elliptical drill intrusion", async () => {
  const circuit = new Circuit({
    platform: { placementDrcChecksDisabled: true },
  })
  circuit.add(
    <board name="B1" width={6} height={5} routingDisabled>
      <net name="GND" />
      <port name="PTH" connectsTo="net.GND" />
      <port name="SAFE" connectsTo="net.GND" />
      <port name="DRILL" connectsTo="net.GND" />
      <platedhole
        portHints={["PTH"]}
        shape="oval"
        outerWidth={3}
        outerHeight={2}
        holeWidth={2}
        holeHeight={1}
      />
      <smtpad
        portHints={["SAFE"]}
        pcbX={0.5}
        pcbY={0.47}
        layer="bottom"
        shape="circle"
        radius={0.01}
      />
      <smtpad
        portHints={["DRILL"]}
        pcbX={0.4}
        pcbY={0.2}
        layer="bottom"
        shape="circle"
        radius={0.1}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const [safe, drill] = circuit.db.pcb_smtpad.list()
  const hole = circuit.db.pcb_plated_hole.list()[0]
  expect(
    getFullConnectivityMapFromCircuitJson(circuitJson).areAllIdsConnected([
      safe.pcb_smtpad_id,
      drill.pcb_smtpad_id,
      hole.pcb_plated_hole_id,
    ]),
  ).toBe(true)
  const errors = checkPcbComponentOverlap(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_smtpad_ids).toEqual([drill.pcb_smtpad_id])
})

test("rotated pill plated pads allow copper contact but reject slot intrusion", async () => {
  const circuit = new Circuit({
    platform: { placementDrcChecksDisabled: true },
  })
  circuit.add(
    <board name="B1" width={6} height={5} routingDisabled>
      <net name="GND" />
      <port name="PTH" connectsTo="net.GND" />
      <port name="SAFE" connectsTo="net.GND" />
      <port name="DRILL" connectsTo="net.GND" />
      <platedhole
        portHints={["PTH"]}
        shape="pill"
        pcbRotation={90}
        outerWidth={3}
        outerHeight={2}
        holeWidth={2}
        holeHeight={0.6}
      />
      <smtpad
        portHints={["SAFE"]}
        pcbX={0.7}
        layer="bottom"
        shape="circle"
        radius={0.1}
      />
      <smtpad
        portHints={["DRILL"]}
        pcbX={0.25}
        pcbY={0.7}
        layer="bottom"
        shape="circle"
        radius={0.1}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const [safe, drill] = circuit.db.pcb_smtpad.list()
  const hole = circuit.db.pcb_plated_hole.list()[0]
  expect(hole).toMatchObject({ shape: "pill", ccw_rotation: 90 })
  expect(
    getFullConnectivityMapFromCircuitJson(circuitJson).areAllIdsConnected([
      safe.pcb_smtpad_id,
      drill.pcb_smtpad_id,
      hole.pcb_plated_hole_id,
    ]),
  ).toBe(true)
  const errors = checkPcbComponentOverlap(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_smtpad_ids).toEqual([drill.pcb_smtpad_id])
})

test("rectangular plated pads preserve the offset of a circular drill", async () => {
  const circuit = new Circuit({
    platform: { placementDrcChecksDisabled: true },
  })
  circuit.add(
    <board name="B1" width={6} height={5} routingDisabled>
      <net name="GND" />
      <port name="PTH" connectsTo="net.GND" />
      <port name="SAFE" connectsTo="net.GND" />
      <port name="DRILL" connectsTo="net.GND" />
      <platedhole
        portHints={["PTH"]}
        shape="circular_hole_with_rect_pad"
        rectPadWidth={3}
        rectPadHeight={2}
        holeDiameter={0.9}
        holeOffsetX={0.6}
        holeOffsetY={0}
      />
      <smtpad
        portHints={["SAFE"]}
        pcbX={-0.6}
        layer="bottom"
        shape="rotated_rect"
        width={0.3}
        height={0.2}
        ccwRotation={45}
      />
      <smtpad
        portHints={["DRILL"]}
        pcbX={0.6}
        layer="bottom"
        shape="circle"
        radius={0.1}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const [safe, drill] = circuit.db.pcb_smtpad.list()
  const hole = circuit.db.pcb_plated_hole.list()[0]
  expect(hole).toMatchObject({
    shape: "circular_hole_with_rect_pad",
    hole_offset_x: 0.6,
    hole_offset_y: 0,
  })
  expect(
    getFullConnectivityMapFromCircuitJson(circuitJson).areAllIdsConnected([
      safe.pcb_smtpad_id,
      drill.pcb_smtpad_id,
      hole.pcb_plated_hole_id,
    ]),
  ).toBe(true)
  const errors = checkPcbComponentOverlap(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_smtpad_ids).toEqual([drill.pcb_smtpad_id])
})

test("rectangular plated pads allow a pill test pad clear of an offset slot", async () => {
  const circuit = new Circuit({
    platform: { placementDrcChecksDisabled: true },
  })
  circuit.add(
    <board name="B1" width={6} height={5} routingDisabled>
      <net name="GND" />
      <port name="PTH" connectsTo="net.GND" />
      <port name="SAFE" connectsTo="net.GND" />
      <port name="DRILL" connectsTo="net.GND" />
      <platedhole
        portHints={["PTH"]}
        shape="pill_hole_with_rect_pad"
        rectPadWidth={4}
        rectPadHeight={2}
        holeWidth={2}
        holeHeight={0.6}
        holeOffsetX={0.4}
        holeOffsetY={-0.3}
      />
      <smtpad
        portHints={["SAFE"]}
        pcbX={-1}
        pcbY={0.5}
        layer="bottom"
        shape="pill"
        width={0.3}
        height={0.2}
        radius={0.1}
      />
      <smtpad
        portHints={["DRILL"]}
        pcbX={1}
        pcbY={-0.3}
        layer="bottom"
        shape="circle"
        radius={0.1}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const [safe, drill] = circuit.db.pcb_smtpad.list()
  const hole = circuit.db.pcb_plated_hole.list()[0]
  expect(hole).toMatchObject({
    shape: "pill_hole_with_rect_pad",
    hole_offset_x: 0.4,
    hole_offset_y: -0.3,
  })
  expect(
    getFullConnectivityMapFromCircuitJson(circuitJson).areAllIdsConnected([
      safe.pcb_smtpad_id,
      drill.pcb_smtpad_id,
      hole.pcb_plated_hole_id,
    ]),
  ).toBe(true)
  const errors = checkPcbComponentOverlap(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_smtpad_ids).toEqual([drill.pcb_smtpad_id])
})

test("rotated rectangular plated pads preserve slot rotation and offset", async () => {
  const circuit = new Circuit({
    platform: { placementDrcChecksDisabled: true },
  })
  circuit.add(
    <board name="B1" width={6} height={5} routingDisabled>
      <net name="GND" />
      <port name="PTH" connectsTo="net.GND" />
      <port name="SAFE" connectsTo="net.GND" />
      <port name="DRILL" connectsTo="net.GND" />
      <platedhole
        portHints={["PTH"]}
        shape="pill_hole_with_rect_pad"
        pcbRotation={45}
        rectPadWidth={4}
        rectPadHeight={3}
        holeWidth={2}
        holeHeight={0.6}
        holeOffsetX={0.4}
        holeOffsetY={-0.3}
      />
      <smtpad
        portHints={["SAFE"]}
        pcbX={-0.6}
        pcbY={0.7}
        layer="bottom"
        shape="rotated_pill"
        width={0.35}
        height={0.2}
        radius={0.1}
        ccwRotation={-30}
      />
      <smtpad
        portHints={["DRILL"]}
        pcbX={0.9}
        pcbY={0.2}
        layer="bottom"
        shape="circle"
        radius={0.1}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const [safe, drill] = circuit.db.pcb_smtpad.list()
  const hole = circuit.db.pcb_plated_hole.list()[0]
  expect(hole).toMatchObject({
    shape: "rotated_pill_hole_with_rect_pad",
    hole_ccw_rotation: 45,
    hole_offset_x: 0.4,
    hole_offset_y: -0.3,
  })
  expect(
    getFullConnectivityMapFromCircuitJson(circuitJson).areAllIdsConnected([
      safe.pcb_smtpad_id,
      drill.pcb_smtpad_id,
      hole.pcb_plated_hole_id,
    ]),
  ).toBe(true)
  const errors = checkPcbComponentOverlap(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_smtpad_ids).toEqual([drill.pcb_smtpad_id])
  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      layer: "bottom",
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})

test("clockwise polygon pads allow copper contact and preserve an offset circular drill", async () => {
  const circuit = new Circuit({
    platform: { placementDrcChecksDisabled: true },
  })
  circuit.add(
    <board name="B1" width={6} height={5} routingDisabled>
      <net name="GND" />
      <port name="PTH" connectsTo="net.GND" />
      <port name="SAFE" connectsTo="net.GND" />
      <port name="DRILL" connectsTo="net.GND" />
      <platedhole
        portHints={["PTH"]}
        shape="hole_with_polygon_pad"
        holeShape="circle"
        holeDiameter={0.9}
        holeOffsetX={0.5}
        holeOffsetY={0}
        padOutline={[
          { x: -2, y: -1 },
          { x: -2, y: 1 },
          { x: 2, y: 1 },
          { x: 2, y: -1 },
        ]}
      />
      <smtpad
        portHints={["SAFE"]}
        pcbX={-1}
        layer="bottom"
        shape="polygon"
        points={[
          { x: -0.1, y: -0.1 },
          { x: -0.1, y: 0.1 },
          { x: 0.1, y: 0.1 },
          { x: 0.1, y: -0.1 },
        ]}
      />
      <smtpad
        portHints={["DRILL"]}
        pcbX={0.5}
        layer="bottom"
        shape="circle"
        radius={0.1}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const [safe, drill] = circuit.db.pcb_smtpad.list()
  const hole = circuit.db.pcb_plated_hole.list()[0]
  expect(
    getFullConnectivityMapFromCircuitJson(circuitJson).areAllIdsConnected([
      safe.pcb_smtpad_id,
      drill.pcb_smtpad_id,
      hole.pcb_plated_hole_id,
    ]),
  ).toBe(true)
  expect(canSameNetPadsOverlap({ elem1: safe, elem2: hole }, circuitJson)).toBe(
    true,
  )
  expect(
    canSameNetPadsOverlap({ elem1: drill, elem2: hole }, circuitJson),
  ).toBe(false)
  const errors = checkPcbComponentOverlap(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_smtpad_ids).toEqual([drill.pcb_smtpad_id])
})

test("polygon plated pads distinguish an elliptical drill from a capsule slot", async () => {
  const circuit = new Circuit({
    platform: { placementDrcChecksDisabled: true },
  })
  circuit.add(
    <board name="B1" width={6} height={5} routingDisabled>
      <net name="GND" />
      <port name="PTH" connectsTo="net.GND" />
      <port name="SAFE" connectsTo="net.GND" />
      <port name="DRILL" connectsTo="net.GND" />
      <platedhole
        portHints={["PTH"]}
        shape="hole_with_polygon_pad"
        holeShape="oval"
        holeWidth={2}
        holeHeight={1}
        holeOffsetX={0}
        holeOffsetY={0}
        padOutline={[
          { x: -2, y: -1 },
          { x: 2, y: -1 },
          { x: 2, y: 1 },
          { x: -2, y: 1 },
        ]}
      />
      <smtpad
        portHints={["SAFE"]}
        pcbX={0.5}
        pcbY={0.47}
        layer="bottom"
        shape="circle"
        radius={0.01}
      />
      <smtpad
        portHints={["DRILL"]}
        layer="bottom"
        shape="circle"
        radius={0.1}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const [safe, drill] = circuit.db.pcb_smtpad.list()
  const hole = circuit.db.pcb_plated_hole.list()[0]
  expect(
    getFullConnectivityMapFromCircuitJson(circuitJson).areAllIdsConnected([
      safe.pcb_smtpad_id,
      drill.pcb_smtpad_id,
      hole.pcb_plated_hole_id,
    ]),
  ).toBe(true)
  expect(canSameNetPadsOverlap({ elem1: safe, elem2: hole }, circuitJson)).toBe(
    true,
  )
  expect(
    canSameNetPadsOverlap({ elem1: drill, elem2: hole }, circuitJson),
  ).toBe(false)
  const errors = checkPcbComponentOverlap(circuitJson)
  expect(errors).toHaveLength(1)
  expect(errors[0].pcb_smtpad_ids).toEqual([drill.pcb_smtpad_id])
})
