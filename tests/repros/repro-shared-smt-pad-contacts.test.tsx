import { expect, test } from "bun:test"
import { Circuit } from "tscircuit"
import { getLabeledPcbSvg } from "tests/fixtures/get-labeled-pcb-svg"
import { checkEachPcbPortConnectedToPcbTraces } from "lib/check-each-pcb-port-connected-to-pcb-trace"

test("shared USB-C power lands connect both source contacts", async () => {
  const circuit = new Circuit()
  circuit.schematicDisabled = true
  circuit.pcbRoutingDisabled = true
  circuit.add(
    <board width={16} height={8}>
      <chip
        name="J_USB_C"
        pcbX={-4}
        pinLabels={{ pin1: "A9", pin2: "B4" }}
        footprint={
          <footprint>
            <smtpad
              portHints={["A9"]}
              pcbX={0}
              pcbY={0}
              width={0.6}
              height={1.45}
              shape="rect"
            />
            <smtpad
              portHints={["B4"]}
              pcbX={0}
              pcbY={0}
              width={0.6}
              height={1.45}
              shape="rect"
            />
          </footprint>
        }
        connections={{ A9: "net.VBUS", B4: "net.VBUS" }}
      />
      <chip
        name="LOAD"
        pcbX={4}
        pinLabels={{ pin1: "VCC" }}
        footprint={
          <footprint>
            <smtpad portHints={["VCC"]} width={1} height={1} shape="rect" />
          </footprint>
        }
        connections={{ VCC: "net.VBUS" }}
      />
      <trace
        from=".J_USB_C > .A9"
        to=".LOAD > .VCC"
        thickness="0.2mm"
        pcbPath={[
          { x: 0, y: 0 },
          { x: 8, y: 0 },
        ]}
      />
      <pcbnotetext
        text="A9 and B4 share one copper land; one VBUS trace connects both"
        pcbX={0}
        pcbY={-2}
        fontSize={0.35}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const errors = checkEachPcbPortConnectedToPcbTraces(circuitJson)
  await expect(
    getLabeledPcbSvg(
      [...circuitJson.filter((e) => !e.type.endsWith("_error")), ...errors],
      "SHARED USB-C POWER LAND",
      [
        "A9 and B4 occupy the same top copper. Only A9 is named by the VBUS trace.",
        `Observed: ${errors.length} unconnected contact error(s). Expected: both contacts connected.`,
        ...errors.map((error) => error.message),
      ],
    ),
  ).toMatchSvgSnapshot(import.meta.path)
  expect(errors).toEqual([])
})
