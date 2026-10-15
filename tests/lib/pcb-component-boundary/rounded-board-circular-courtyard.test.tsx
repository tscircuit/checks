import { expect, test } from "bun:test"
import { Circuit } from "tscircuit"
import { checkPcbComponentsOutOfBoard } from "lib/check-pcb-components-out-of-board/checkPcbComponentsOutOfBoard"

test("a circular pad and courtyard fit inside a rounded board corner", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width={38.4} height={38.4} borderRadius={3.2} routingDisabled>
      <chip
        name="J1"
        pcbX={-16}
        pcbY={-16}
        footprint={
          <footprint>
            <platedhole
              shape="circle"
              holeDiameter={3.45}
              outerDiameter={5.2}
              portHints={["1"]}
            />
            <courtyardcircle radius={2.99} layer="top" />
          </footprint>
        }
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()

  expect(
    circuitJson.find((element) => element.type === "pcb_plated_hole"),
  ).toMatchObject({
    type: "pcb_plated_hole",
    shape: "circle",
    x: -16,
    y: -16,
    outer_diameter: 5.2,
  })
  expect(
    circuitJson.find((element) => element.type === "pcb_courtyard_circle"),
  ).toMatchObject({
    type: "pcb_courtyard_circle",
    center: { x: -16, y: -16 },
    radius: 2.99,
    layer: "top",
  })
  // Both circles fit inside the 3.2 mm corner arc, even though the pad's square bounds do not.
  expect(checkPcbComponentsOutOfBoard(circuitJson)).toEqual([])
})
