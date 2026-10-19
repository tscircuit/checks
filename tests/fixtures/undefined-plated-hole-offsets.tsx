import { Circuit } from "@tscircuit/core"

export const undefinedPlatedHoleOffsetsFixture = async () => {
  // Run the local checks explicitly, rather than core's bundled checks.
  const circuit = new Circuit({ platform: { routingDrcChecksDisabled: true } })
  circuit.add(
    <board width={20} height={20}>
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
            <platedhole
              portHints={["2"]}
              pcbX={2.5}
              pcbY={0}
              shape="circle"
              holeDiameter={0.92}
              outerDiameter={1.5}
            />
          </footprint>
        }
      />
      <resistor name="R1" resistance="1k" footprint="0402" pcbX={0} pcbY={-6} />
      <trace
        from=".J1 > .pin1"
        to=".R1 > .pin1"
        pcbPathRelativeTo=".J1 > .pin1"
        pcbPath={[
          { x: 0, y: 0 },
          { x: -0.5, y: -0.5 },
          { x: -0.5, y: -6 },
        ]}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const hole = circuitJson.find(
    (element) =>
      element.type === "pcb_plated_hole" &&
      element.shape === "circular_hole_with_rect_pad",
  )!
  // Preserve the in-memory input from issue #434 even if core later normalizes
  // these fields. A JSON fixture would silently drop both undefined keys.
  Object.assign(hole, { hole_offset_x: undefined, hole_offset_y: undefined })
  return circuitJson
}
