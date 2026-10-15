import { expect, test } from "bun:test"
import { Circuit } from "tscircuit"
import { checkPcbComponentsOutOfBoard } from "lib/check-pcb-components-out-of-board/checkPcbComponentsOutOfBoard"
import { normalizeFixtureSourcePorts } from "../../fixtures/normalize-fixture-source-ports"

for (const radius of [null, 2, 2.99, 3.5]) {
  test(`round mounting pad in rounded corners with courtyard radius ${radius}`, async () => {
    const circuit = new Circuit()
    circuit.add(
      <board width={38.4} height={38.4} borderRadius={3.2} routingDisabled>
        {[-16, 16].flatMap((pcbX) =>
          [-16, 16].map((pcbY, index) => (
            <chip
              key={`${pcbX},${pcbY}`}
              name={`J${pcbX < 0 ? index + 1 : index + 3}`}
              pcbX={pcbX}
              pcbY={pcbY}
              footprint={
                <footprint>
                  <platedhole
                    shape="circle"
                    holeDiameter={3.45}
                    outerDiameter={5.2}
                    portHints={["1"]}
                  />
                  {radius !== null && (
                    <courtyardcircle radius={radius} layer="top" />
                  )}
                </footprint>
              }
            />
          )),
        )}
      </board>,
    )
    await circuit.renderUntilSettled()
    const circuitJson = normalizeFixtureSourcePorts(circuit.getCircuitJson())
    const errors = checkPcbComponentsOutOfBoard(circuitJson)
    expect(errors).toHaveLength(radius === 3.5 ? 4 : 0)
    for (const error of errors) {
      expect(error.message).toContain("0.3mm")
      expect(
        error.component_bounds.max_x - error.component_bounds.min_x,
      ).toBeCloseTo(7)
    }
  })
}

test("a smaller circular courtyard does not hide copper outside the board", async () => {
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
              outerDiameter={7}
              portHints={["1"]}
            />
            <courtyardcircle radius={2.99} layer="top" />
          </footprint>
        }
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const errors = checkPcbComponentsOutOfBoard(
    normalizeFixtureSourcePorts(circuit.getCircuitJson()),
  )
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain("0.3mm")
})
