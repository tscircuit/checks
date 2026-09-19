import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Fragment } from "react"
import { checkPcbCopperOverKeepout } from "lib/check-pcb-copper-over-keepout"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"

test("keepout permissions independently allow traces and placements, never vias", async () => {
  const circuit = new Circuit({ platform: { drcChecksDisabled: true } })
  circuit.add(
    <board width={76} height={30} routingDisabled schematicDisabled>
      <pcbnotetext text="KEEPOUT PERMISSIONS" pcbY={13} fontSize={1} />
      {[-24, 0, 24].map((x) => (
        <Fragment key={x}>
          <pcbnotetext
            text={`<keepout shape="rect"\n  width={8} height={8}\n  ${x <= 0 ? "allowTraces " : ""}${x >= 0 ? "allowPlacements " : ""}/>`}
            pcbX={x - 11}
            pcbY={10}
            anchorAlignment="top_left"
            fontSize={0.7}
          />
          <keepout shape="rect" width={8} height={8} pcbX={x} />
          <testpoint
            name={`TP${x + 24}`}
            footprintVariant="pad"
            pcbX={x}
            pcbY={2}
          />
          <pcbnotetext
            text={
              x < 0
                ? "pad: error | trace: allowed"
                : x > 0
                  ? "pad: allowed | trace: error"
                  : "pad + trace: allowed"
            }
            pcbX={x}
            pcbY={-6}
            fontSize={0.65}
          />
          <pcbnotetext
            text="via: error (both permissions)"
            pcbX={x}
            pcbY={-9}
            fontSize={0.65}
          />
        </Fragment>
      ))}
    </board>,
  )
  await circuit.renderUntilSettled()
  // The installed core does not emit the new flags yet; checks consume Circuit JSON.
  const circuitJson: AnyCircuitElement[] = circuit
    .getCircuitJson()
    .map((element) =>
      element.type === "pcb_keepout" && element.shape === "rect"
        ? {
            ...element,
            allow_traces: element.center.x <= 0,
            allow_placements: element.center.x >= 0,
          }
        : element,
    )
  for (const x of [-24, 0, 24]) {
    circuitJson.push({
      type: "pcb_trace",
      pcb_trace_id: `trace_${x}`,
      route: [x - 6, x + 6].map((px) => ({
        route_type: "wire",
        x: px,
        y: -2,
        width: 0.3,
        layer: "top",
      })),
    })
    circuitJson.push({
      type: "pcb_via",
      pcb_via_id: `via_${x}`,
      x: x + 2,
      y: 0,
      hole_diameter: 0.2,
      outer_diameter: 0.5,
      layers: ["top", "bottom"],
    })
  }
  for (const warning_only of [false, true]) {
    const input = circuitJson.map((element) =>
      element.type === "pcb_keepout" ? { ...element, warning_only } : element,
    )
    const placements = checkPcbCopperOverKeepout(input)
    const traces = checkEachPcbTraceNonOverlapping(input)
    expect(placements).toHaveLength(4) // One prohibited pad and all three vias.
    expect(traces).toHaveLength(1)
    expect(
      placements.every(
        (d) =>
          d.type ===
          (warning_only
            ? "pcb_keepout_overlap_warning"
            : "pcb_placement_error"),
      ),
    ).toBe(true)
    expect(traces[0].type).toBe(
      warning_only ? "pcb_keepout_overlap_warning" : "pcb_trace_error",
    )
  }
  expect(
    convertCircuitJsonToPcbSvg(circuitJson, { width: 1400, height: 600 }),
  ).toMatchSvgSnapshot(import.meta.path)
})
