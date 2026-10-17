import { expect, test } from "bun:test"
import { Circuit, PcbNoteText } from "@tscircuit/core"
import { Fragment } from "react"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { runAllRoutingChecks } from "../../lib/run-all-checks"

test("repro: routing checks miss a dead-end GND pour finger", async () => {
  const circuit = new Circuit()
  circuit.add(
    <board width={14} height={16} layers={2} schematicDisabled routingDisabled>
      <net name="GND" />
      {[-4, 4].map((y, i) => (
        <chip
          key={i}
          name={`J${i + 1}`}
          pcbY={y}
          pinLabels={{ pin1: "TX", pin2: "GND", pin3: "RX" }}
          footprint={
            <footprint>
              {[-2.54, 0, 2.54].map((x, pin) => (
                <Fragment key={pin}>
                  <platedhole
                    portHints={[`pin${pin + 1}`]}
                    pcbX={x}
                    holeDiameter={0.8}
                    outerDiameter={1.6}
                    shape="circle"
                  />
                </Fragment>
              ))}
              <silkscreenrect width={7.6} height={2.5} />
            </footprint>
          }
        />
      ))}
      {[-1, 1].map((side, i) => (
        <Fragment key={side}>
          <trace
            from={`.J1 > .pin${i * 2 + 1}`}
            to={`.J2 > .pin${i * 2 + 1}`}
            thickness={0.25}
            pcbPath={[
              { x: side * 0.75, y: 1.79 },
              { x: side * 0.75, y: 6.21 },
            ]}
          />
        </Fragment>
      ))}
      <trace from=".J1 > .GND" to="net.GND" />
      <trace from=".J2 > .GND" to="net.GND" />
      <copperpour
        layer="top"
        connectsTo="net.GND"
        useThermalReliefs={false}
        outline={[
          { x: -1.5, y: -5.5 },
          { x: 1.5, y: -5.5 },
          { x: 1.5, y: -3 },
          { x: 0.4, y: -1.9 },
          { x: 0.4, y: 2.3 },
          { x: -0.4, y: 2.3 },
          { x: -0.4, y: -1.9 },
          { x: -1.5, y: -3 },
        ]}
      />
      <copperpour
        layer="bottom"
        connectsTo="net.GND"
        useThermalReliefs={false}
        outline={[
          { x: -1, y: -5.5 },
          { x: 1, y: -5.5 },
          { x: 1, y: 5.5 },
          { x: -1, y: 5.5 },
        ]}
      />
      <pcbnotetext text="UART ADAPTER / TOP COPPER" pcbY={7} fontSize={0.6} />
      {["TX", "GND", "RX"].map((name, i) => (
        <Fragment key={name}>
          <pcbnotetext
            text={name}
            pcbX={(i - 1) * 2.54}
            pcbY={5.6}
            fontSize={0.5}
          />
        </Fragment>
      ))}
      <pcbnotetext
        text="Dead-end GND finger"
        pcbY={0.8}
        pcbX={3.9}
        fontSize={0.4}
      />
      <pcbnotepath
        route={[
          { x: 3.9, y: 1.2 },
          { x: 1.9, y: 2.7 },
          { x: 0, y: 2.3 },
        ]}
        color="#ffd54f"
      />
      <pcbnotetext
        text="GND pins connected on bottom copper"
        pcbY={-6.8}
        fontSize={0.45}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()
  const errors = await runAllRoutingChecks(circuitJson)
  // The narrow top-layer tongue has no pad/via/trace at its tip, but passes DRC.
  expect(errors).toEqual([])
  circuit.children[0]!.add(
    new PcbNoteText({
      text: `Routing DRC errors: ${errors.length}`,
      pcbY: -8.8,
      fontSize: 0.55,
      color: errors.length ? "#ff6b6b" : "white",
    }),
  )
  if (errors.length) {
    circuit.children[0]!.add(
      new PcbNoteText({
        text: errors
          .map((error) => error.message.match(/.{1,65}(?:\s|$)/g)!.join("\n"))
          .join("\n"),
        pcbY: -10.5,
        fontSize: 0.4,
        color: "#ff6b6b",
      }),
    )
  }
  await circuit.renderUntilSettled()
  await expect(
    convertCircuitJsonToPcbSvg([...circuit.getCircuitJson(), ...errors], {
      layer: "top",
      width: 900,
      height: 1250,
      viewport: { minX: -7.8, maxX: 7.8, minY: -12, maxY: 8.5 },
      shouldDrawErrors: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
