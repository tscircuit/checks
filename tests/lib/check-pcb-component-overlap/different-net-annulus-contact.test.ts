import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { gunzipSync } from "node:zlib"
import type { AnyCircuitElement } from "circuit-json"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"

test("annulus contact still reports a pad on a different or unassigned net", () => {
  const circuit: AnyCircuitElement[] = JSON.parse(
    gunzipSync(
      readFileSync(
        new URL("../../assets/butterstick-placement.json.gz", import.meta.url),
      ),
    ).toString(),
  )
  const component = circuit.find(
    (element) => element.type === "source_component" && element.name === "C165",
  )
  if (component?.type !== "source_component") throw new Error("Missing C165")
  const port = circuit.find(
    (element) =>
      element.type === "source_port" &&
      element.source_component_id === component.source_component_id &&
      element.port_hints?.includes("pin1"),
  )
  if (port?.type !== "source_port")
    throw new Error("Missing C165 positive terminal")
  const negativePort = circuit.find(
    (element) =>
      element.type === "source_port" &&
      element.source_component_id === component.source_component_id &&
      element.port_hints?.includes("pin2"),
  )
  if (negativePort?.type !== "source_port")
    throw new Error("Missing C165 negative terminal")
  const member = circuit.find(
    (element) =>
      element.type === "source_trace" &&
      element.connected_source_port_ids.includes(port.source_port_id),
  )
  if (member?.type !== "source_trace")
    throw new Error("Missing C165 connection")
  const disconnected = circuit.filter(
    (element) =>
      element.type !== "source_trace" ||
      !element.connected_source_port_ids.includes(port.source_port_id),
  )
  const grounded: AnyCircuitElement[] = [
    ...disconnected,
    {
      ...member,
      connected_source_net_ids: [],
      connected_source_port_ids: [
        port.source_port_id,
        negativePort.source_port_id,
      ],
    },
  ]
  for (const circuit of [disconnected, grounded]) {
    const errors = checkPcbComponentOverlap(circuit)
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("C165.NATIVE_1")
    expect(errors[0].message).toContain("U18.NATIVE_8")
  }
})
