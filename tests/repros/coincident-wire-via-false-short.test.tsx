import { expect, test } from "bun:test"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"
import { Circuit } from "tscircuit"

async function renderViaLanding(outerDiameter: number) {
  const circuit = new Circuit()
  circuit.add(
    <board width={4} height={4} layers={4} routingDisabled schematicDisabled>
      <via
        name="VMOT"
        pcbY={0.375}
        fromLayer="top"
        toLayer="bottom"
        holeDiameter={0.2}
        outerDiameter={outerDiameter}
        connectsTo="net.VMOT"
      />
      <pcbnotetext text="VMOT" pcbX={0.65} pcbY={1.15} fontSize={0.13} />
      <pcbnotetext text="CTRL" pcbX={-1} pcbY={-0.25} fontSize={0.13} />
    </board>,
  )
  await circuit.renderUntilSettled()
  const records = circuit.getCircuitJson()
  const via = records.find((record) => record.type === "pcb_via")!
  via.pcb_trace_id = "vmot"

  // Reduced from the four-axis carrier's route. The incoming top wire
  // is narrow. Its wider endpoint is coincident with the layer change.
  const vmot: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "vmot",
    route: [
      { route_type: "wire", x: 0, y: 1.25, width: 0.325, layer: "top" },
      { route_type: "wire", x: 0, y: 0.375, width: 0.8, layer: "top" },
      {
        route_type: "via",
        x: 0,
        y: 0.375,
        from_layer: "top",
        to_layer: "bottom",
      },
      { route_type: "wire", x: 0, y: 0.375, width: 0.8, layer: "bottom" },
      { route_type: "wire", x: 0, y: -1.25, width: 0.8, layer: "bottom" },
    ],
  }
  const ctrl: PcbTrace = {
    type: "pcb_trace",
    pcb_trace_id: "ctrl",
    route: [
      { route_type: "wire", x: -1.4, y: 0, width: 0.2, layer: "top" },
      { route_type: "wire", x: 1.4, y: 0, width: 0.2, layer: "top" },
    ],
  }
  return [...records, vmot, ctrl] satisfies AnyCircuitElement[]
}

test("a coincident wire and via report a short across a clear top-layer gap", async () => {
  const circuitJson = await renderViaLanding(0.3)
  const errors = checkEachPcbTraceNonOverlapping(circuitJson, {
    minClearance: 0.1,
  })
  expect(errors).toHaveLength(1)
  expect(errors[0].message).toContain("accidental contact")

  const enlargedVia = await renderViaLanding(0.8)
  const realErrors = checkEachPcbTraceNonOverlapping(enlargedVia, {
    minClearance: 0.1,
  })
  expect(realErrors.some((error) => error.message.includes("via"))).toBe(true)

  const countNote = {
    type: "pcb_note_text",
    pcb_note_text_id: "status",
    text: `Routing errors: ${errors.length}`,
    anchor_position: { x: 0, y: -0.8 },
    anchor_alignment: "center",
    font: "tscircuit2024",
    font_size: 0.14,
    layer: "top",
    color: "#facc15",
  } satisfies AnyCircuitElement
  await expect(
    convertCircuitJsonToPcbSvg([...circuitJson, countNote, ...errors], {
      layer: "top",
      viewport: { minX: -1.7, maxX: 1.7, minY: -1.05, maxY: 1.55 },
      width: 680,
      height: 520,
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
