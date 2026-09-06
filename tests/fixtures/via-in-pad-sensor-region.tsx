import type { AnyCircuitElement, PcbPort, PcbTrace } from "circuit-json"
import { Fragment } from "react"
import { Circuit } from "tscircuit"

const SensorRegion = () => (
  <board
    width="21mm"
    height="15mm"
    layers={4}
    routingDisabled
    isViaInPadAllowed
  >
    <chip
      name="U1"
      footprint="soic8"
      pcbX={1}
      pcbY={0}
      pinLabels={{ 1: "VDD", 4: "GND", 5: "SDA", 6: "SCL" }}
    />
    <capacitor
      name="C1"
      capacitance="100nF"
      footprint="0603"
      pcbX={-4}
      pcbY={2}
    />
    <capacitor
      name="C2"
      capacitance="1uF"
      footprint="0603"
      pcbX={-4}
      pcbY={-2}
    />
    <chip
      name="J1"
      pcbX={7}
      pcbY={0}
      pinLabels={{ 1: "VDD", 2: "GND", 3: "SDA", 4: "SCL" }}
      footprint={
        <footprint>
          {[1, 2, 3, 4].map((pin) => (
            <Fragment key={pin}>
              <smtpad
                shape="rect"
                width="1.2mm"
                height="0.6mm"
                pcbX={0}
                pcbY={2.5 - pin}
                portHints={[`pin${pin}`]}
              />
            </Fragment>
          ))}
          <silkscreenrect width="2.4mm" height="4.5mm" />
        </footprint>
      }
    />
    {[
      ["U1.VDD", "VDD"],
      ["U1.GND", "GND"],
      ["C1.pin2", "VDD"],
      ["C1.pin1", "GND"],
      ["C2.pin2", "VDD"],
      ["C2.pin1", "GND"],
      ["J1.VDD", "VDD"],
      ["J1.GND", "GND"],
      ["U1.SDA", "SDA"],
      ["J1.SDA", "SDA"],
      ["U1.SCL", "SCL"],
      ["J1.SCL", "SCL"],
    ].map(([endpoint, net]) => {
      const [component, pin] = endpoint.split(".")
      return (
        <Fragment key={endpoint}>
          <trace from={`.${component} > .${pin}`} to={`net.${net}`} />
        </Fragment>
      )
    })}
    <pcbnotetext
      text="Sensor interface / intentional via-in-pad"
      pcbX={0}
      pcbY={6.4}
      fontSize="0.42mm"
    />
    <pcbnotetext
      text="SOIC-8 + 0603 decoupling + 1 mm connector"
      pcbX={0}
      pcbY={5.55}
      fontSize="0.32mm"
    />
    <pcbnotetext
      text="cyan: inner1    purple: inner2    yellow: top"
      pcbX={0}
      pcbY={4.7}
      fontSize="0.3mm"
    />
    <pcbnotetext text="C1 100 nF" pcbX={-6.6} pcbY={2} fontSize="0.27mm" />
    <pcbnotetext text="C2 1 uF" pcbX={-6.6} pcbY={-2} fontSize="0.27mm" />
    <pcbnotetext text="J1" pcbX={7} pcbY={2.65} fontSize="0.32mm" />
    <pcbnotetext text="VDD" pcbX={1} pcbY={3.85} fontSize="0.27mm" />
    <pcbnotetext text="GND" pcbX={1} pcbY={-3.95} fontSize="0.27mm" />
    <pcbnotetext text="SDA" pcbX={4.8} pcbY={-2.35} fontSize="0.27mm" />
    <pcbnotetext text="SCL" pcbX={4.8} pcbY={1.1} fontSize="0.27mm" />
    <pcbnotetext
      text="Each inner route ends on a separate through-via inside a top pad."
      pcbX={0}
      pcbY={-6.25}
      fontSize="0.28mm"
    />
  </board>
)

type Layer = Extract<PcbTrace["route"][number], { route_type: "wire" }>["layer"]

/**
 * Deterministic subset of a sensor board, using real generated component pads.
 * Copper follows core's happy-autorouter output: a top wire -> through-via stub
 * per pad, plus separate net-level inner traces carrying endpoint port IDs and
 * no source_trace_id. No autorouter or external footprint lookup is involved.
 */
export async function getViaInPadSensorRegion(): Promise<AnyCircuitElement[]> {
  const circuit = new Circuit({
    platform: {
      netlistDrcChecksDisabled: true,
      placementDrcChecksDisabled: true,
    },
  })
  circuit.add(<SensorRegion />)
  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()

  function port(componentName: string, pin: string): PcbPort {
    const component = circuitJson.find(
      (element) =>
        element.type === "source_component" && element.name === componentName,
    )!
    if (component.type !== "source_component")
      throw new Error("Missing component")
    const sourcePort = circuitJson.find(
      (element) =>
        element.type === "source_port" &&
        element.source_component_id === component.source_component_id &&
        element.port_hints?.includes(pin),
    )!
    if (sourcePort.type !== "source_port")
      throw new Error("Missing source port")
    return circuitJson.find(
      (element) =>
        element.type === "pcb_port" &&
        element.source_port_id === sourcePort.source_port_id,
    ) as PcbPort
  }

  function wire(x: number, y: number, layer: Layer) {
    return { route_type: "wire" as const, x, y, layer, width: 0.25 }
  }

  function addPadVia(component: string, pin: string) {
    const padPort = port(component, pin)
    const id = `${component}_${pin}`
    circuitJson.push(
      {
        type: "pcb_trace",
        pcb_trace_id: `pcb_trace_stub_${id}`,
        route: [
          {
            ...wire(padPort.x, padPort.y, "top"),
            start_pcb_port_id: padPort.pcb_port_id,
            end_pcb_port_id: padPort.pcb_port_id,
          },
          {
            route_type: "via",
            x: padPort.x,
            y: padPort.y,
            from_layer: "top",
            to_layer: "bottom",
            outer_diameter: 0.4,
            hole_diameter: 0.2,
          },
        ],
      },
      {
        type: "pcb_via",
        pcb_via_id: `pcb_via_${id}`,
        pcb_trace_id: `pcb_trace_stub_${id}`,
        x: padPort.x,
        y: padPort.y,
        layers: ["top", "inner1", "inner2", "bottom"],
        outer_diameter: 0.4,
        hole_diameter: 0.2,
      },
    )
  }

  function addRoute(
    name: string,
    from: [string, string],
    to: [string, string],
    layer: Layer,
    bends: [number, number][] = [],
  ) {
    const a = port(...from)
    const b = port(...to)
    circuitJson.push({
      type: "pcb_trace",
      pcb_trace_id: `pcb_trace_${name}`,
      route: [
        { ...wire(a.x, a.y, layer), start_pcb_port_id: a.pcb_port_id },
        ...bends.map(([x, y]) => wire(x, y, layer)),
        { ...wire(b.x, b.y, layer), end_pcb_port_id: b.pcb_port_id },
      ],
    })
  }

  for (const [component, pin] of [
    ["U1", "VDD"],
    ["U1", "GND"],
    ["C1", "pin1"],
    ["C1", "pin2"],
    ["C2", "pin1"],
    ["C2", "pin2"],
    ["U1", "SDA"],
    ["U1", "SCL"],
    ["J1", "SDA"],
    ["J1", "SCL"],
  ])
    addPadVia(component, pin)

  addRoute("vdd_u1_c1", ["U1", "VDD"], ["C1", "pin2"], "inner1")
  addRoute("vdd_c1_c2", ["C1", "pin2"], ["C2", "pin2"], "inner1")
  addRoute("gnd_u1_c1", ["U1", "GND"], ["C1", "pin1"], "inner2", [
    [-2, -1.905],
    [-4.825, 0.9],
  ])
  addRoute("gnd_c1_c2", ["C1", "pin1"], ["C2", "pin1"], "inner2")
  addRoute("sda", ["U1", "SDA"], ["J1", "SDA"], "inner1", [
    [4.4, -1.905],
    [5.805, -0.5],
  ])
  addRoute("scl", ["U1", "SCL"], ["J1", "SCL"], "inner2", [
    [4.4, -0.635],
    [5.265, -1.5],
  ])
  addRoute("connector_vdd", ["U1", "VDD"], ["J1", "VDD"], "top", [
    [-1.15, 3.5],
    [7, 3.5],
  ])
  addRoute("connector_gnd", ["U1", "GND"], ["J1", "GND"], "top", [
    [-1.15, -3.5],
    [8.5, -3.5],
    [8.5, 0.5],
  ])

  return circuitJson
}
