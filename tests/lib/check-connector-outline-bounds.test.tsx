import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import type { PcbComponent } from "circuit-json"
import { checkConnectorAccessibleOrientation } from "lib/check-connector-accessible-orientation"
import { outline } from "../fixtures/connector-explicit-outline"

const edges = [
  {
    x: -16.4,
    y: -17.5,
    facing: "x-",
    outward: "from_left",
    inward: "from_right",
  },
  {
    x: 44.625,
    y: -20,
    facing: "x+",
    outward: "from_right",
    inward: "from_left",
  },
  { x: 12, y: 25, facing: "y+", outward: "from_top", inward: "from_bottom" },
  { x: 12, y: -28, facing: "y-", outward: "from_bottom", inward: "from_top" },
] as const

function Connector({
  name,
  x,
  y,
  direction,
}: {
  name: string
  x: number
  y: number
  direction: PcbComponent["insertion_direction"]
}) {
  return (
    <connector
      name={name}
      pcbX={x}
      pcbY={y}
      footprint={
        <footprint insertionDirection={direction}>
          <smtpad portHints={["pin1"]} shape="rect" width={1} height={1} />
        </footprint>
      }
    />
  )
}

for (const reverse of [false, true]) {
  test(`outline bounds accept outward and reject inward connectors (reverse=${reverse})`, async () => {
    const circuit = new Circuit({ platform: { drcChecksDisabled: true } })
    circuit.add(
      <board
        width={75}
        height={55}
        outline={reverse ? [...outline].reverse() : outline}
        routingDisabled
        schematicDisabled
      >
        {edges.flatMap((edge, i) => [
          <Connector
            key={`out${i}`}
            name={`J_OUT_${i}`}
            {...edge}
            direction={edge.outward}
          />,
          <Connector
            key={`in${i}`}
            name={`J_IN_${i}`}
            {...edge}
            direction={edge.inward}
          />,
        ])}
      </board>,
    )
    await circuit.renderUntilSettled()
    const json = circuit.getCircuitJson()
    const original = structuredClone(json)
    const components = json.filter((e) => e.type === "pcb_component")
    const warnings = checkConnectorAccessibleOrientation(json)
    expect(
      warnings.map((w) => [w.pcb_component_id, w.recommended_facing_direction]),
    ).toEqual(
      edges.map((edge, i) => [
        components[i * 2 + 1].pcb_component_id,
        edge.facing,
      ]),
    )
    expect(warnings.map((w) => w.message.split(" ")[0])).toEqual(
      edges.map((_, i) => `J_IN_${i}`),
    )
    expect(json).toEqual(original)
  })
}

test("boards without an outline retain centered rectangle bounds", async () => {
  const circuit = new Circuit({ platform: { drcChecksDisabled: true } })
  circuit.add(
    <board width={75} height={55} routingDisabled schematicDisabled>
      <Connector name="J_BOTTOM" x={-16.4} y={-17.5} direction="from_bottom" />
      <Connector name="J_LEFT" x={-16.4} y={-17.5} direction="from_left" />
    </board>,
  )
  await circuit.renderUntilSettled()
  const json = circuit.getCircuitJson()
  const board = json.find((e) => e.type === "pcb_board")!
  expect(board.outline).toBeUndefined()
  const warnings = checkConnectorAccessibleOrientation(json)
  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toMatchObject({
    facing_direction: "x-",
    recommended_facing_direction: "y-",
  })
  expect(warnings[0].message).toStartWith("J_LEFT ")
  // Older exports may serialize the absent outline as []; geometry is unchanged.
  expect(
    checkConnectorAccessibleOrientation(
      json.map((e) => (e === board ? { ...board, outline: [] } : e)),
    ),
  ).toEqual(warnings)
})
