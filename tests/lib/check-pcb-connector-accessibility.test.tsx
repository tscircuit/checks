import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { checkPcbConnectorAccessibility } from "lib/check-pcb-connector-accessibility"

const ConnectorPlacementTestCircuit = () => (
  <board width="20mm" height="12mm" routingDisabled>
    <chip
      name="J1"
      pcbX={-8.8}
      pcbY={0}
      pinLabels={{ 1: ["VBUS"] }}
      footprint={
        <footprint>
          <smtpad
            shape="rect"
            width="1.2mm"
            height="1.2mm"
            pcbX="0mm"
            pcbY="0mm"
            portHints={["VBUS"]}
          />
        </footprint>
      }
    />

    <chip
      name="J2"
      pcbX={8.8}
      pcbY={0}
      pinLabels={{ 1: ["VBUS"] }}
      footprint={
        <footprint>
          <smtpad
            shape="rect"
            width="1.2mm"
            height="1.2mm"
            pcbX="0mm"
            pcbY="0mm"
            portHints={["VBUS"]}
          />
        </footprint>
      }
    />
  </board>
)

test("checkPcbConnectorAccessibility warns when cable insertion faces inward", async () => {
  const circuit = new Circuit()
  circuit.add(<ConnectorPlacementTestCircuit />)

  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson() as any[]

  const sourceComponentsByName = new Map(
    circuitJson
      .filter((element) => element.type === "source_component")
      .map((component) => [component.name, component.source_component_id]),
  )

  for (const pcbComponent of circuitJson.filter(
    (element) => element.type === "pcb_component",
  )) {
    if (!pcbComponent.center || !pcbComponent.source_component_id) continue

    const sourceName = [...sourceComponentsByName.entries()].find(
      ([, sourceComponentId]) =>
        sourceComponentId === pcbComponent.source_component_id,
    )?.[0]

    if (sourceName === "J1") {
      pcbComponent.cable_insertion_center = {
        x: pcbComponent.center.x + 1,
        y: pcbComponent.center.y,
      }
    }

    if (sourceName === "J2") {
      pcbComponent.cable_insertion_center = {
        x: pcbComponent.center.x + 1,
        y: pcbComponent.center.y,
      }
    }
  }

  const warnings = checkPcbConnectorAccessibility(circuitJson as any)

  expect(warnings).toHaveLength(1)
  expect(warnings[0]?.type).toBe(
    "pcb_connector_not_in_accessible_orientation_warning",
  )
  expect(warnings[0]?.facing_direction).toBe("x+")
  expect(warnings[0]?.recommended_facing_direction).toBe("x-")

  expect(
    convertCircuitJsonToPcbSvg([...(circuitJson as any), ...warnings], {
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
