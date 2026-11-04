import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import {
  convertCircuitJsonToFlattenJs,
  renderFlattenJsToSvg,
} from "@tscircuit/circuit-json-to-flattenjs"
import type { AnyCircuitElement, PcbTraceWarning } from "circuit-json"
import { runAllRoutingChecks } from "lib/run-all-checks"
import { normalizeFixtureSourcePorts } from "../fixtures/normalize-fixture-source-ports"

async function widthSnapshot(
  circuitJson: AnyCircuitElement[],
  warnings: PcbTraceWarning[],
  title: string,
  expectedWarnings: number,
  name: string,
) {
  const geometry = convertCircuitJsonToFlattenJs(circuitJson, {
    roles: ["copper"],
    strict: true,
  })
  const copper = renderFlattenJsToSvg(geometry, {
    width: 400,
    height: 400,
    background: "white",
    viewport: { minX: -3, maxX: 13, minY: -3, maxY: 13 },
  })
  // Returned warning centers use board coordinates; SVG's Y axis points down.
  const markers = warnings
    .map(
      ({ center }) =>
        `<circle cx="${center!.x}" cy="${-center!.y!}" r="0.5" fill="none" stroke="#c62828" stroke-width="0.1"/>`,
    )
    .join("")
  const status = warnings.length === expectedWarnings ? "PASS" : "FAIL"
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="650" height="540" viewBox="0 0 650 540">
    <rect width="650" height="540" fill="white"/>
    <g font-family="Arial, sans-serif" fill="#222" text-anchor="middle">
      <text x="325" y="32" font-size="22">${status}: ${title}</text>
      <text x="325" y="60" font-size="16">Expected ${expectedWarnings} width warnings; received ${warnings.length}.</text>
    </g>
    <g transform="translate(125 105)">${copper.replace("</svg>", `${markers}</svg>`)}</g>
  </svg>`
  if (process.env.TRACE_WIDTH_EVIDENCE)
    await Bun.write(`${process.env.TRACE_WIDTH_EVIDENCE}/${name}.svg`, svg)
  return svg
}

test.failing("USB ground ignores an unrelated narrow branch", async () => {
  const circuit = new Circuit({ platform: { routingDrcChecksDisabled: true } })
  circuit.add(
    <board width={30} height={30} schematicDisabled routeRemaining={false}>
      <testpoint
        name="A"
        pcbX={0}
        pcbY={0}
        footprintVariant="pad"
        padDiameter={0.5}
      />
      <testpoint
        name="B"
        pcbX={10}
        pcbY={0}
        footprintVariant="pad"
        padDiameter={0.5}
      />
      <testpoint
        name="C"
        pcbX={10}
        pcbY={10}
        footprintVariant="pad"
        padDiameter={0.5}
      />
      <net name="GND" />
      <trace
        name="USB_GND_1"
        path={["A.pin1", "B.pin1", "net.GND"]}
        thickness={0.5}
        pcbPath={["A.pin1", "B.pin1"]}
      />
      <trace
        name="INPUT_DVDT_LOCAL_GROUND"
        from="B.pin1"
        to="C.pin1"
        thickness={0.2}
        pcbPath={["B.pin1", "C.pin1"]}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = normalizeFixtureSourcePorts(circuit.getCircuitJson())
  expect(circuitJson.filter((e) => e.type === "pcb_trace")).toHaveLength(2)
  expect(circuitJson.filter((e) => e.type === "pcb_trace_error")).toEqual([])
  const warnings = (await runAllRoutingChecks(circuitJson)).filter(
    (e) => e.type === "pcb_trace_warning",
  )
  const svg = await widthSnapshot(
    circuitJson,
    warnings,
    "USB ground 0.5 mm; separate branch 0.2 mm",
    0,
    "usb-ground-width",
  )
  expect(warnings).toEqual([])
  await expect(svg).toMatchSvgSnapshot(import.meta.path, "usb-ground-width")
})

test.failing("TEC hot loop ignores an unrelated narrow branch", async () => {
  const circuit = new Circuit({ platform: { routingDrcChecksDisabled: true } })
  circuit.add(
    <board width={30} height={30} schematicDisabled routeRemaining={false}>
      <testpoint
        name="A"
        pcbX={0}
        pcbY={0}
        footprintVariant="pad"
        padDiameter={0.5}
      />
      <testpoint
        name="B"
        pcbX={10}
        pcbY={0}
        footprintVariant="pad"
        padDiameter={0.5}
      />
      <testpoint
        name="C"
        pcbX={10}
        pcbY={10}
        footprintVariant="pad"
        padDiameter={0.5}
      />
      <net name="TEC_VIN" />
      <trace
        name="TEC_INPUT_HOT_LOOP"
        path={["A.pin1", "B.pin1", "net.TEC_VIN"]}
        thickness={3}
        pcbPath={["A.pin1", "B.pin1"]}
      />
      <trace
        name="TEC_CONTROLLER_VIN"
        from="B.pin1"
        to="C.pin1"
        thickness={0.2}
        pcbPath={["B.pin1", "C.pin1"]}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = normalizeFixtureSourcePorts(circuit.getCircuitJson())
  expect(circuitJson.filter((e) => e.type === "pcb_trace")).toHaveLength(2)
  expect(circuitJson.filter((e) => e.type === "pcb_trace_error")).toEqual([])
  const warnings = (await runAllRoutingChecks(circuitJson)).filter(
    (e) => e.type === "pcb_trace_warning",
  )
  const svg = await widthSnapshot(
    circuitJson,
    warnings,
    "TEC hot loop 3 mm; separate branch 0.2 mm",
    0,
    "tec-hot-loop-width",
  )
  expect(warnings).toEqual([])
  await expect(svg).toMatchSvgSnapshot(import.meta.path, "tec-hot-loop-width")
})

test("undersized owned USB copper still warns", async () => {
  const circuit = new Circuit({ platform: { routingDrcChecksDisabled: true } })
  circuit.add(
    <board width={30} height={30} schematicDisabled routingDisabled>
      <testpoint
        name="A"
        pcbX={0}
        pcbY={0}
        footprintVariant="pad"
        padDiameter={0.5}
      />
      <testpoint
        name="B"
        pcbX={10}
        pcbY={0}
        footprintVariant="pad"
        padDiameter={0.5}
      />
      <net name="GND" />
      <trace
        name="USB_GND_1"
        path={["A.pin1", "B.pin1", "net.GND"]}
        thickness={0.5}
      />
      <pcbtrace
        source_trace_id="source_trace_0"
        route={[
          {
            route_type: "wire",
            x: 0,
            y: 0,
            width: 0.2,
            layer: "top",
            start_pcb_port_id: "pcb_port_0",
          },
          {
            route_type: "wire",
            x: 10,
            y: 0,
            width: 0.2,
            layer: "top",
            end_pcb_port_id: "pcb_port_1",
          },
        ]}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = normalizeFixtureSourcePorts(circuit.getCircuitJson())
  expect(circuitJson.filter((e) => e.type === "pcb_trace")).toHaveLength(1)
  const warnings = (await runAllRoutingChecks(circuitJson)).filter(
    (e) => e.type === "pcb_trace_warning",
  )
  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toMatchObject({
    source_trace_id: "source_trace_0",
    pcb_trace_id: "pcb_trace_0",
  })
  expect(warnings[0].message).toContain("requested: 0.5mm, actual: 0.2mm")
  const svg = await widthSnapshot(
    circuitJson,
    warnings,
    "Owned USB copper 0.2 mm; required 0.5 mm",
    1,
    "undersized-owned-usb-width",
  )
  await expect(svg).toMatchSvgSnapshot(
    import.meta.path,
    "undersized-owned-usb-width",
  )
})

test("unowned legacy copper still warns through net connectivity", async () => {
  const circuit = new Circuit({ platform: { routingDrcChecksDisabled: true } })
  circuit.add(
    <board width={30} height={30} schematicDisabled routingDisabled>
      <testpoint
        name="A"
        pcbX={0}
        pcbY={0}
        footprintVariant="pad"
        padDiameter={0.5}
      />
      <testpoint
        name="B"
        pcbX={10}
        pcbY={0}
        footprintVariant="pad"
        padDiameter={0.5}
      />
      <net name="GND" />
      <trace
        name="USB_GND_1"
        path={["A.pin1", "B.pin1", "net.GND"]}
        thickness={0.5}
      />
      <pcbtrace
        route={[
          {
            route_type: "wire",
            x: 0,
            y: 0,
            width: 0.2,
            layer: "top",
            start_pcb_port_id: "pcb_port_0",
          },
          {
            route_type: "wire",
            x: 10,
            y: 0,
            width: 0.2,
            layer: "top",
            end_pcb_port_id: "pcb_port_1",
          },
        ]}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = normalizeFixtureSourcePorts(circuit.getCircuitJson())
  const traces = circuitJson.filter((e) => e.type === "pcb_trace")
  expect(traces).toHaveLength(1)
  expect(traces[0].source_trace_id).toBeUndefined()
  const warnings = (await runAllRoutingChecks(circuitJson)).filter(
    (e) => e.type === "pcb_trace_warning",
  )
  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toMatchObject({
    source_trace_id: "source_trace_0",
    pcb_trace_id: "pcb_trace_0",
  })
  const svg = await widthSnapshot(
    circuitJson,
    warnings,
    "Unowned copper 0.2 mm; required 0.5 mm",
    1,
    "legacy-unowned-width",
  )
  await expect(svg).toMatchSvgSnapshot(import.meta.path, "legacy-unowned-width")
})
