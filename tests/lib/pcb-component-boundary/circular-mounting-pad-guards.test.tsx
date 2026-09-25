import { expect, test } from "bun:test"
import { Circuit } from "tscircuit"
import { checkPcbComponentsOutOfBoard } from "lib/check-pcb-components-out-of-board/checkPcbComponentsOutOfBoard"

test("a circular pad does not exempt an explicit square courtyard", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width={10} height={10} borderRadius={2} routingDisabled>
      <chip
        name="U1"
        pcbX={3}
        pcbY={3}
        footprint={
          <footprint>
            <platedhole shape="circle" holeDiameter={1} outerDiameter={3} />
            <courtyardrect width={3} height={3} />
          </footprint>
        }
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  expect(checkPcbComponentsOutOfBoard(circuit.getCircuitJson())).toHaveLength(1)
})

test("a circular pad does not exempt another pad crossing the board", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width={10} height={10} borderRadius={2} routingDisabled>
      <chip
        name="U1"
        pcbX={3}
        pcbY={3}
        footprint={
          <footprint>
            <platedhole shape="circle" holeDiameter={1} outerDiameter={3} />
            <smtpad
              shape="rect"
              pcbX={1.2}
              pcbY={1.2}
              width={0.6}
              height={0.6}
            />
          </footprint>
        }
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  expect(checkPcbComponentsOutOfBoard(circuit.getCircuitJson())).toHaveLength(1)
})

test("a circular pad does not replace larger component bounds", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width={10} height={10} borderRadius={2} routingDisabled>
      <chip
        name="U1"
        pcbX={3}
        pcbY={3}
        footprint={
          <footprint>
            <platedhole shape="circle" holeDiameter={1} outerDiameter={3} />
          </footprint>
        }
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const component = circuitJson.find(
    (element) => element.type === "pcb_component",
  )!
  component.width = 5
  expect(checkPcbComponentsOutOfBoard(circuitJson)).toHaveLength(1)
})

test("a circular mounting pad with its center outside the board is rejected", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width={10} height={10} routingDisabled>
      <chip
        name="H1"
        pcbX={6}
        footprint={
          <footprint>
            <platedhole shape="circle" holeDiameter={1} outerDiameter={3} />
          </footprint>
        }
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const errors = checkPcbComponentsOutOfBoard(circuit.getCircuitJson())
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain("2.5mm")
})
