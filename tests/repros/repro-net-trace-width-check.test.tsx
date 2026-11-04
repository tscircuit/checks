import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkSourceTracesMatchPcbTraceThickness } from "../../lib/check-source-traces-match-pcb-trace-thickness"

test("repro: width check skips port-to-net traces", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width="22mm" height="10mm" autorouter="auto_local">
      <resistor name="R1" resistance="1k" footprint="0603" pcbX={-6} />
      <resistor name="R2" resistance="1k" footprint="0603" pcbX={6} />
      <net name="POWER" />
      <trace from="R1.pin2" to="net.POWER" thickness="0.3mm" />
      <trace from="R2.pin1" to="net.POWER" thickness="0.3mm" />
      <pcbnotetext text="POWER: minimum 0.30 mm" pcbY={3.5} fontSize={0.65} />
      <pcbnotetext
        text="Injected copper width: 0.18 mm"
        pcbY={-2.5}
        fontSize={0.55}
      />
      <pcbnotetext
        text="Expected: 2 width warnings"
        pcbY={-3.7}
        fontSize={0.5}
      />
    </board>,
  )
  await circuit.renderUntilSettled()

  const sourceTraces = circuit.db.source_trace.list()
  expect(sourceTraces).toHaveLength(2)
  for (const trace of sourceTraces) {
    expect(trace.min_trace_thickness).toBe(0.3)
    expect(trace.connected_source_port_ids).toHaveLength(1)
    expect(trace.connected_source_net_ids).toHaveLength(1)
  }

  // Simulate undersized router output; the minimum still comes from TSX.
  const pcbTraces = circuit.db.pcb_trace.list()
  expect(pcbTraces).toHaveLength(1)
  for (const trace of pcbTraces) {
    circuit.db.pcb_trace.update(trace.pcb_trace_id, {
      route: trace.route.map((point) => {
        if (point.route_type === "wire") return { ...point, width: 0.18 }
        return point
      }),
    })
  }

  const warnings = checkSourceTracesMatchPcbTraceThickness(
    circuit.getCircuitJson(),
  )
  expect(warnings).toHaveLength(0)
  const statusNote = circuit.db.pcb_note_text.list().at(-1)!
  circuit.db.pcb_note_text.update(statusNote.pcb_note_text_id, {
    text: `Expected: 2 width warnings / reported: ${warnings.length}`,
  })
  expect(
    convertCircuitJsonToPcbSvg(circuit.getCircuitJson()),
  ).toMatchSvgSnapshot(import.meta.path)

  // Positive control: identical copper is detected with both ports on one trace.
  circuit.db.source_trace.update(sourceTraces[0].source_trace_id, {
    connected_source_port_ids: sourceTraces.flatMap(
      (trace) => trace.connected_source_port_ids,
    ),
  })
  expect(
    checkSourceTracesMatchPcbTraceThickness(circuit.getCircuitJson()),
  ).not.toHaveLength(0)
})
