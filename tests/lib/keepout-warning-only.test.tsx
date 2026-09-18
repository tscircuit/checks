import { expect, test } from "bun:test"
import { Circuit } from "@tscircuit/core"
import type { AnyCircuitElement } from "circuit-json"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkPcbCopperOverKeepout } from "lib/check-pcb-copper-over-keepout"
import { checkEachPcbTraceNonOverlapping } from "lib/check-each-pcb-trace-non-overlapping/check-each-pcb-trace-non-overlapping"

const renderDemo = async (diagnostics: AnyCircuitElement[] = []) => {
  const circuit = new Circuit({ platform: { drcChecksDisabled: true } })
  circuit.add(
    <board width={56} height={32} routingDisabled schematicDisabled>
      <pcbnotetext
        text="KEEPOUT DRC: ADVISORY vs ENFORCING"
        pcbY={14}
        fontSize={1}
        color="white"
      />
      {[-13, 13].map((x) => (
        <group key={x}>
          <keepout shape="rect" width={8} height={8} pcbX={x} />
          <smtpad shape="rect" width={1.2} height={1.2} pcbX={x} pcbY={2} />
          <pcbnotetext
            text={`pcb_keepout {\n  shape: "rect",\n  width: 8, height: 8,\n  warning_only: ${x < 0}\n}`}
            pcbX={x - 10}
            pcbY={11}
            anchorAlignment="top_left"
            fontSize={0.8}
            color="#ffd166"
          />
          <pcbnotetext
            text="<smtpad width={1.2} height={1.2} />"
            pcbX={x}
            pcbY={5}
            fontSize={0.6}
          />
          <pcbnotetext
            text='{ route_type: "wire", width: 0.3 }'
            pcbX={x}
            pcbY={-5}
            fontSize={0.65}
          />
          <pcbnotetext
            text={
              x < 0
                ? "ADVISORY: pad + trace warn"
                : "ENFORCING: pad + trace error"
            }
            pcbX={x}
            pcbY={-7}
            fontSize={0.8}
            color={x < 0 ? "#ffd166" : "#ff6b6b"}
          />
          {diagnostics.length > 0 && (
            <pcbnotetext
              text={diagnostics
                .filter((d) =>
                  x < 0
                    ? d.type === "pcb_keepout_overlap_warning"
                    : d.type !== "pcb_keepout_overlap_warning",
                )
                .map((d, i) => `${i === 0 ? "pad" : "trace"}: ${d.type}`)
                .join("\n")}
              pcbX={x - 11}
              pcbY={-10}
              anchorAlignment="top_left"
              fontSize={0.65}
              color={x < 0 ? "#ffd166" : "#ff6b6b"}
            />
          )}
        </group>
      ))}
    </board>,
  )
  await circuit.renderUntilSettled()
  // The checks consume Circuit JSON; the installed core release predates flag emission.
  const circuitJson = circuit
    .getCircuitJson()
    .map((element) =>
      element.type === "pcb_keepout" && element.shape === "rect"
        ? { ...element, warning_only: element.center.x < 0 }
        : element,
    )
  return [
    ...circuitJson,
    ...[-13, 13].map(
      (x): AnyCircuitElement => ({
        type: "pcb_trace",
        pcb_trace_id: `trace_${x}`,
        route: [x - 6, x + 6].map((px) => ({
          route_type: "wire",
          x: px,
          y: -2,
          width: 0.3,
          layer: "top",
        })),
      }),
    ),
  ]
}

test("advisory keepouts warn for the same pad and trace overlaps that enforcing keepouts reject", async () => {
  const circuitJson = await renderDemo()
  const diagnostics = [
    ...checkPcbCopperOverKeepout(circuitJson),
    ...checkEachPcbTraceNonOverlapping(circuitJson),
  ]
  expect(diagnostics.map((d) => d.type).sort()).toEqual([
    "pcb_keepout_overlap_warning",
    "pcb_keepout_overlap_warning",
    "pcb_placement_error",
    "pcb_trace_error",
  ])
  const annotated = await renderDemo(diagnostics)
  expect(
    convertCircuitJsonToPcbSvg([...annotated, ...diagnostics], {
      width: 1200,
      height: 700,
      // The notes show actual diagnostic types without overlapping renderer labels.
      shouldDrawErrors: false,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
