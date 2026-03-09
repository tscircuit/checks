import { expect, test } from "bun:test"
import type { ChipProps } from "@tscircuit/props"
import { runAllNetlistChecks } from "lib/run-all-checks"
import { Circuit } from "tscircuit"

const usbCPinLabels = {
  1: ["GND1", "A1"],
  2: ["GND2", "B12"],
  3: ["VBUS1", "A4"],
  4: ["VBUS2", "B9"],
} as const

const SmdUsbC = (props: ChipProps & { name: string }) => {
  return (
    <chip
      {...props}
      pinLabels={usbCPinLabels}
      manufacturerPartNumber="TYPE-C-31-M-12"
      footprint={
        <footprint>
          <smtpad
            portHints={["A1"]}
            pcbX="-1.5mm"
            pcbY="0mm"
            width="0.6mm"
            height="1.2mm"
            shape="rect"
          />
          <smtpad
            portHints={["B12"]}
            pcbX="-0.5mm"
            pcbY="0mm"
            width="0.6mm"
            height="1.2mm"
            shape="rect"
          />
          <smtpad
            portHints={["A4"]}
            pcbX="0.5mm"
            pcbY="0mm"
            width="0.6mm"
            height="1.2mm"
            shape="rect"
          />
          <smtpad
            portHints={["B9"]}
            pcbX="1.5mm"
            pcbY="0mm"
            width="0.6mm"
            height="1.2mm"
            shape="rect"
          />
        </footprint>
      }
    />
  )
}

test("test.tsx builds and has no netlist errors", async () => {
  const circuit = new Circuit()

  circuit.add(
    <board width="12mm" height="30mm">
      <SmdUsbC
        name="USBC"
        pinAttributes={{
          GND1: { mustBeConnected: false },
        }}
        connections={{
          GND1: "net.GND",
          GND2: "net.GND",
          VBUS1: "net.VBUS",
          VBUS2: "net.VBUS",
        }}
        pcbY={-10}
        schX={-4}
      />
      <led name="LED" color="red" footprint="0603" pcbY={12} schY={2} />
      <resistor name="R1" footprint="0603" resistance="1k" pcbY={7} />

      <trace from=".USBC > .VBUS1" to=".R1 > .pos" />
      <trace from=".USBC > .VBUS2" to=".USBC > .VBUS1" />
      <trace from=".R1 > .neg" to=".LED .pos" />
      <trace from=".LED .neg" to=".USBC > .GND1" />
      <trace from=".USBC > .GND2" to=".USBC > .GND1" />
    </board>,
  )

  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()

  const netlistErrors = await runAllNetlistChecks(circuitJson as any)
  expect(netlistErrors).toEqual([])
})
