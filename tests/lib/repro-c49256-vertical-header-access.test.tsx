import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { checkConnectorAccessibleOrientation } from "lib/check-connector-accessible-orientation"
import { Circuit } from "tscircuit"

// Reduced from the C49256 import used on a 50 x 48 mm four-gang touch panel.
// Keep the generic chip representation, eight 2.54 mm-pitch pads and outline;
// omit CAD models and unrelated panel electronics. No direction is declared.
const HeaderBoard = ({ diagnostic }: { diagnostic?: string }) => (
  <board width={50} height={48} routingDisabled>
    <chip
      name="J1"
      manufacturerPartNumber="Header2.54mm 1*8P"
      supplierPartNumbers={{ jlcpcb: ["C49256"] }}
      pcbY={-21}
      pinLabels={Object.fromEntries(
        Array.from({ length: 8 }, (_, i) => [`pin${i + 1}`, [`pin${i + 1}`]]),
      )}
      footprint={
        <footprint>
          <platedhole
            portHints={["pin1"]}
            pcbX={-8.89}
            pcbY={0}
            holeWidth={1}
            holeHeight={1}
            outerWidth={1.5}
            outerHeight={1.5}
            rectPad
            shape="pill"
          />
          {Array.from({ length: 7 }, (_, i) => (
            <platedhole
              portHints={[`pin${i + 2}`]}
              pcbX={-8.89 + (i + 1) * 2.54}
              pcbY={0}
              outerDiameter={1.5}
              holeDiameter={1}
              shape="circle"
            />
          ))}
          <silkscreenpath
            route={[
              { x: -10.16, y: -1.27 },
              { x: 10.16, y: -1.27 },
              { x: 10.16, y: 1.27 },
              { x: -10.16, y: 1.27 },
              { x: -10.16, y: -1.27 },
            ]}
          />
        </footprint>
      }
    />
    <pcbnotetext
      text="C49256 vertical header: mates above PCB (+Z)"
      pcbY={-14}
      fontSize={0.5}
    />
    <pcbnotetext
      text="No explicit insertion direction in imported footprint"
      pcbY={-15}
      fontSize={0.45}
    />
    {diagnostic && <pcbnotetext text={diagnostic} pcbY={-16} fontSize={0.45} />}
  </board>
)

test("repro: generic-chip C49256 receives an inferred side-access warning", async () => {
  const circuit = new Circuit()
  circuit.add(<HeaderBoard />)
  await circuit.renderUntilSettled()
  const json = circuit.getCircuitJson()
  const source = json.find(
    (e) => e.type === "source_component" && e.name === "J1",
  )!
  const header = json.find((e) => e.type === "pcb_component")!
  expect(source).toMatchObject({ ftype: "simple_chip" })
  expect(header.type).toBe("pcb_component")
  if (header.type !== "pcb_component") throw new Error("Missing header")
  expect(header.insertion_direction).toBeUndefined()
  expect(json.filter((e) => e.type === "pcb_plated_hole")).toHaveLength(8)

  // Replay the inferred center supplied by core for the original C49256 at
  // (0, -21). This is geometry inference, not a real side-entry declaration.
  const input = json.map((e) =>
    e.type === "pcb_component" && e.pcb_component_id === header.pcb_component_id
      ? { ...e, cable_insertion_center: { x: 0, y: -19.33 } }
      : e,
  )
  const warnings = checkConnectorAccessibleOrientation(input)
  expect(warnings).toHaveLength(1)
  expect(warnings[0]).toMatchObject({
    facing_direction: "y+",
    recommended_facing_direction: "y-",
  })
  expect(warnings.map((w) => w.message)).toMatchInlineSnapshot(`
    [
      "J1 is inferred to face y+ from its cable insertion center because no explicit footprint insertionDirection is defined, but should face y- so the connector is accessible from the board edge. Set insertionDirection on the <footprint> to specify the actual direction in the footprint's unrotated orientation; for example, <footprint insertionDirection="from_above"> for a connector accessed from above the PCB (+Z).",
    ]
  `)

  // Same geometry/inferred center, but the native header classification gets
  // the existing exemption. This contrast is the policy inconsistency.
  const nativeHeaderInput = input.map((e) =>
    e.type === "source_component" &&
    e.ftype === "simple_chip" &&
    e.source_component_id === header.source_component_id
      ? {
          ...e,
          ftype: "simple_pin_header" as const,
          pin_count: 8,
          gender: "male" as const,
        }
      : e,
  )
  expect(checkConnectorAccessibleOrientation(nativeHeaderInput)).toEqual([])

  const annotated = new Circuit()
  annotated.add(
    <HeaderBoard
      diagnostic={`Observed warning: inferred ${warnings[0].facing_direction}; checker recommends ${warnings[0].recommended_facing_direction}`}
    />,
  )
  await annotated.renderUntilSettled()
  expect(
    convertCircuitJsonToPcbSvg(annotated.getCircuitJson(), {
      width: 1000,
      height: 500,
      showPcbNotes: true,
      showPinNumbers: true,
      shouldDrawWarnings: false,
      viewport: { minX: -13, maxX: 13, minY: -24, maxY: -12 },
    }).replace(/[ \t]+$/gm, ""),
  ).toMatchSvgSnapshot(import.meta.path)
}, 20_000)
