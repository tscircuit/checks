import { expect, test } from "bun:test"
import { Circuit } from "tscircuit"
import { checkPcbComponentsOutOfBoard } from "lib/check-pcb-components-out-of-board/checkPcbComponentsOutOfBoard"

test("board boundaries use actual pad and courtyard geometry", async () => {
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
  const courtyard = circuitJson.find(
    (element) => element.type === "pcb_courtyard_circle",
  )!
  expect(courtyard).toMatchObject({
    type: "pcb_courtyard_circle",
    center: { x: -16, y: -16 },
    radius: 2.99,
    layer: "top",
  })
  // Both circles fit inside the 3.2 mm corner arc, even though the pad's square bounds do not.
  expect(checkPcbComponentsOutOfBoard(circuitJson)).toEqual([])

  // An offset courtyard also fits; it does not need to share the pad's centre.
  courtyard.center = { x: -15.9, y: -15.9 }
  expect(checkPcbComponentsOutOfBoard(circuitJson)).toEqual([])

  courtyard.radius = 3.5
  expect(checkPcbComponentsOutOfBoard(circuitJson)).toMatchObject([
    {
      type: "pcb_component_outside_board_error",
      component_center: { x: -16, y: -16 },
      component_bounds: {
        min_x: expect.closeTo(-19.4),
        min_y: -19.4,
        max_x: -12.4,
        max_y: -12.4,
      },
    },
  ])
})
