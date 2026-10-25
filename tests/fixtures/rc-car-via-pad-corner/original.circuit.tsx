import { Fragment } from "react"
// CarKit-inspired external-ESC receiver carrier. See README.md for limits.
// XIAO socket: official Seeed DIP geometry, rotated USB toward +Y.
const pins = {
  pin1: "D0",
  pin2: "D1",
  pin3: "D2",
  pin4: "D3",
  pin5: "D4",
  pin6: "D5",
  pin7: "D6",
  pin8: "D7",
  pin9: "D8",
  pin10: "D9",
  pin11: "D10",
  pin12: "V3V3",
  pin13: "GND",
  pin14: "V5",
} as const
const nets: Record<string, string[]> = {
  GND: [
    "U1.GND",
    "J1.pin1",
    "J2.pin1",
    "C1.pin2",
    "C2.pin2",
    "C3.pin2",
    "R3.pin2",
    "R4.pin2",
  ],
  BEC5V: ["J1.pin2", "J2.pin2", "D1.anode", "C1.pin1", "C2.pin1"],
  MCU5V: ["D1.cathode", "U1.V5", "C3.pin1"],
  ESC_GPIO: ["U1.D1", "R1.pin1"],
  SERVO_GPIO: ["U1.D2", "R2.pin1"],
  ESC_PWM: ["R1.pin2", "R3.pin1", "J1.pin3"],
  SERVO_PWM: ["R2.pin2", "R4.pin1", "J2.pin3"],
}
export default function RcCarEsc() {
  return (
    <board
      width="60mm"
      height="45mm"
      layers={2}
      schLayout={{ layoutMode: "none" }}
      title="RC CAR / ESC + SERVO"
    >
      <schematicsheet name="Main" displayName="RC car ESC carrier">
        <schematicsection
          name="MCU"
          displayName="XIAO ESP32-C3 / USB on module"
        />
        <schematicsection
          name="Power"
          displayName="5V BEC / USB backfeed isolation"
        />
        <schematicsection
          name="Control"
          displayName="ESC + steering / 3.3V PWM"
        />
        <chip
          name="U1"
          manufacturerPartNumber="Seeed XIAO ESP32C3"
          pinLabels={pins}
          pinAttributes={{
            V5: { requiresPower: true },
            GND: { requiresGround: true },
            V3V3: { providesPower: true },
            D1: { isOutput: true },
            D2: { isOutput: true },
          }}
          pcbX={-13}
          pcbY={7}
          schX={-8}
          schY={0}
          schSectionName="MCU"
          footprint={
            <footprint>
              {Array.from({ length: 14 }, (_, i) => {
                const left = i < 7
                return (
                  <Fragment key={i}>
                    <platedhole
                      shape="circle"
                      holeDiameter={0.889}
                      outerDiameter={1.524}
                      pcbX={left ? -7.62 : 7.62}
                      pcbY={left ? 7.62 - i * 2.54 : -7.62 + (i - 7) * 2.54}
                      portHints={[`pin${i + 1}`]}
                    />
                  </Fragment>
                )
              })}
              <courtyardrect pcbX={0} pcbY={0} width={18.3} height={21.5} />
              <silkscreenrect pcbX={0} pcbY={0} width={17.8} height={21} />
            </footprint>
          }
        />
        <pinheader
          name="J1"
          pinCount={3}
          pitch="2.54mm"
          pcbX={22}
          pcbY={10}
          pcbRotation={90}
          schX={10}
          schY={4}
          schSectionName="Control"
          pinLabels={["GND", "BEC5V", "ESC"]}
        />
        <pinheader
          name="J2"
          pinCount={3}
          pitch="2.54mm"
          pcbX={22}
          pcbY={-6}
          pcbRotation={90}
          schX={10}
          schY={-4}
          schSectionName="Control"
          pinLabels={["GND", "BEC5V", "SERVO"]}
        />
        <resistor
          name="R1"
          resistance="220"
          footprint="0805"
          pcbX={7}
          pcbY={10}
          schX={3}
          schY={4}
          schSectionName="Control"
        />
        <resistor
          name="R2"
          resistance="220"
          footprint="0805"
          pcbX={7}
          pcbY={-6}
          schX={3}
          schY={-4}
          schSectionName="Control"
        />
        <resistor
          name="R3"
          resistance="100k"
          footprint="0805"
          pcbX={15}
          pcbY={6}
          pcbRotation={90}
          schX={6}
          schY={2}
          schRotation={90}
          schSectionName="Control"
        />
        <resistor
          name="R4"
          resistance="100k"
          footprint="0805"
          pcbX={15}
          pcbY={-10}
          pcbRotation={90}
          schX={6}
          schY={-6}
          schRotation={90}
          schSectionName="Control"
        />
        <diode
          name="D1"
          footprint="sma"
          manufacturerPartNumber="SS14"
          pcbX={0}
          pcbY={-13}
          pcbRotation={180}
          schX={-8}
          schY={-12}
          schRotation={90}
          schSectionName="Power"
        />
        <capacitor
          name="C1"
          capacitance="100uF"
          footprint="electrolytic_d6.3mm_p2.5mm"
          pcbX={22}
          pcbY={2}
          schX={-2}
          schY={-12}
          schRotation={-90}
          schSectionName="Power"
        />
        <capacitor
          name="C2"
          capacitance="100nF"
          footprint="0805"
          pcbX={11}
          pcbY={0}
          schX={2}
          schY={-12}
          schRotation={-90}
          schSectionName="Power"
        />
        <capacitor
          name="C3"
          capacitance="10uF"
          footprint="0805"
          pcbX={-8}
          pcbY={-12}
          schX={-12}
          schY={-12}
          schRotation={-90}
          schSectionName="Power"
        />
        {Object.entries(nets).flatMap(([net, ports]) =>
          ports.map((port) => (
            <Fragment key={`${net}-${port}`}>
              <trace
                from={port}
                to={`net.${net}`}
                thickness={net === "BEC5V" || net === "GND" ? 1 : 0.3}
              />
            </Fragment>
          )),
        )}
        {[-25, 25].flatMap((x) =>
          [-17.5, 17.5].map((y) => (
            <Fragment key={`${x},${y}`}>
              <hole diameter={3.2} pcbX={x} pcbY={y} />
            </Fragment>
          )),
        )}
        <silkscreentext text="RC CAR / ESC" pcbX={0} pcbY={20} fontSize={1.3} />
        <silkscreentext text="5V BEC ONLY" pcbX={0} pcbY={-19} fontSize={1.2} />
        <silkscreentext
          text="S 5V G"
          pcbX={26}
          pcbY={10}
          pcbRotation={90}
          fontSize={1}
        />
        <silkscreentext
          text="S 5V G"
          pcbX={26}
          pcbY={-6}
          pcbRotation={90}
          fontSize={1}
        />
        <silkscreentext text="USB" pcbX={-13} pcbY={19} fontSize={1} />
      </schematicsheet>
    </board>
  )
}
