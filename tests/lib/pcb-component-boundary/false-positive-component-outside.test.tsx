import { test, expect } from "bun:test"
import { Circuit } from "tscircuit"
import { checkPcbComponentsOutOfBoard } from "lib/check-pcb-components-out-of-board/checkPcbComponentsOutOfBoard"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement } from "circuit-json"

const MinimalRp2040Breakout = () => (
  <board width="34mm" height="42mm" routingDisabled>
    <chip
      name="U2"
      footprint="pinrow_1x20_2.54mm"
      pinLabels={{
        pin1: "VBUS",
        pin2: "GND",
        pin3: "3V3",
        pin4: "GP0",
        pin5: "GP1",
        pin6: "GP2",
        pin7: "GP3",
        pin8: "GP4",
        pin9: "GP5",
        pin10: "GP6",
        pin11: "GP7",
        pin12: "GP8",
        pin13: "GP9",
        pin14: "GP10",
        pin15: "GP11",
        pin16: "GP12",
        pin17: "GP13",
        pin18: "GP14",
        pin19: "GP15",
        pin20: "SWCLK",
      }}
      pcbX={-13.97}
      pcbY={0}
      pcbRotation={90}
      schX={-16}
      schY={0}
    />

    <chip
      name="U3"
      footprint="pinrow_1x20_2.54mm"
      pinLabels={{
        pin1: "SWD",
        pin2: "RUN",
        pin3: "GP16",
        pin4: "GP17",
        pin5: "GP18",
        pin6: "GP19",
        pin7: "GP20",
        pin8: "GP21",
        pin9: "GP22",
        pin10: "GP23",
        pin11: "GP24",
        pin12: "GP25",
        pin13: "GP26",
        pin14: "GP27",
        pin15: "GP28",
        pin16: "GP29",
        pin17: "ADC_AVDD",
        pin18: "VREG_IN",
        pin19: "USB_DP",
        pin20: "USB_DM",
      }}
      pcbX={13.97}
      pcbY={0}
      pcbRotation={270}
      schX={16}
      schY={0}
    />
  </board>
)

test("no false positive: pinrow connectors rotated 90/270 inside board should not trigger errors", async () => {
  const circuit = new Circuit()
  circuit.add(<MinimalRp2040Breakout />)
  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson() as AnyCircuitElement[]
  const errors = checkPcbComponentsOutOfBoard(circuitJson)

  expect(
    convertCircuitJsonToPcbSvg(
      [...circuitJson, ...errors] as AnyCircuitElement[],
      {
        shouldDrawErrors: true,
      },
    ),
  ).toMatchSvgSnapshot(import.meta.path)

  expect(errors.length).toBe(0)
})
