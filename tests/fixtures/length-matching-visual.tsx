// Keep the existing renderer for older snapshots; this release emits source_bus.
import { Circuit } from "tscircuit-for-length-tests"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import type { AnyCircuitElement, PcbTrace } from "circuit-json"
import { getPcbTraceLength } from "../../lib/util/get-pcb-trace-length"

const Terminal = ({ name, x, y }: { name: string; x: number; y: number }) => (
  <chip
    name={name}
    pcbX={x}
    pcbY={y}
    pinLabels={{ pin1: "SIGNAL" }}
    footprint={
      <footprint>
        <smtpad
          portHints={["pin1"]}
          pcbX={0}
          pcbY={0}
          width={1}
          height={1}
          shape="rect"
        />
      </footprint>
    }
  />
)

/** Two deterministic routes: D0 = 20mm; D1 = 5 + 20 + 5 = 30mm.
 * Both the constraints and the copper come from TSX, without injecting source
 * buses or overriding trace_length in the generated Circuit JSON.
 */
export const renderLengthMatchingBoard = async (requirements: {
  maxLengthSkew?: number
  maxLength?: number
}) => {
  const circuit = new Circuit()
  circuit.add(
    <board width={30} height={24} routingDisabled schematicDisabled>
      {requirements.maxLengthSkew !== undefined && (
        <bus
          name="DATA"
          connections={["D0", "D1"]}
          maxLengthSkew={requirements.maxLengthSkew}
        />
      )}
      <Terminal name="TX0" x={-10} y={4} />
      <Terminal name="RX0" x={10} y={4} />
      <Terminal name="TX1" x={-10} y={-2} />
      <Terminal name="RX1" x={10} y={-2} />
      <trace
        name="D0"
        from=".TX0 > .pin1"
        to=".RX0 > .pin1"
        thickness={0.3}
        pcbPathRelativeTo=".TX0 > .pin1"
        pcbPath={[
          { x: 0, y: 0 },
          { x: 20, y: 0 },
        ]}
      />
      <trace
        name="D1"
        from=".TX1 > .pin1"
        to=".RX1 > .pin1"
        thickness={0.3}
        maxLength={requirements.maxLength}
        pcbPathRelativeTo=".TX1 > .pin1"
        pcbPath={[
          { x: 0, y: 0 },
          { x: 0, y: -5 },
          { x: 20, y: -5 },
          { x: 20, y: 0 },
        ]}
      />
      <pcbnotetext text="D0  /  STRAIGHT" pcbX={0} pcbY={6.5} fontSize={0.85} />
      <pcbnotetext text="D1  /  DETOUR" pcbX={0} pcbY={-4} fontSize={0.85} />
      <pcbnotetext text="20 mm" pcbX={0} pcbY={2} fontSize={0.85} />
      <pcbnotetext
        text="5 mm + 20 mm + 5 mm"
        pcbX={0}
        pcbY={-9.5}
        fontSize={0.8}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  return circuit.getCircuitJson()
}

const escape = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")

export const measuredMembers = (circuit: AnyCircuitElement[]) =>
  circuit
    .filter((e) => e.type === "source_trace")
    .map((source) => ({
      name: source.name!,
      length: circuit
        .filter(
          (e): e is PcbTrace =>
            e.type === "pcb_trace" &&
            e.source_trace_id === source.source_trace_id,
        )
        .reduce((sum, trace) => sum + getPcbTraceLength(trace), 0),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

/** The SVG renderer does not yet render the dedicated length error types.
 * Show the check's actual message and measurements in an explicit result panel,
 * alongside unmodified circuit-to-svg PCB output. Never synthesize an error.
 */
export const lengthComparisonSvg = ({
  title,
  subtitle,
  cases,
}: {
  title: string
  subtitle: string
  cases: Array<{
    title: string
    jsx: string[]
    circuit: AnyCircuitElement[]
    errors: Array<{ type: string; message: string }>
    comparison: string
  }>
}) => {
  const text = (
    x: number,
    y: number,
    value: string,
    size = 18,
    fill = "#1e293b",
    weight = 400,
  ) =>
    `<text x="${x}" y="${y}" font-family="Arial, sans-serif" font-size="${size}" fill="${fill}" font-weight="${weight}">${escape(value)}</text>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="900" viewBox="0 0 1280 900">
    <rect width="1280" height="900" fill="#eef2f6" />
    ${text(32, 48, title, 30, "#0f172a", 700)}
    ${text(32, 80, subtitle, 17, "#475569")}
    ${cases
      .map((fixture, index) => {
        const x = 32 + index * 624
        const failed = fixture.errors.length > 0
        const color = failed ? "#b91c1c" : "#047857"
        const members = measuredMembers(fixture.circuit)
        const pcb = convertCircuitJsonToPcbSvg(fixture.circuit, {
          width: 552,
          height: 340,
          shouldDrawErrors: true,
        }).replace(/<svg\b/, `<svg x="${x + 20}" y="236"`)
        const message =
          fixture.errors[0]?.message ?? "No length errors returned."
        const words = message.split(" ")
        const lines: string[] = [""]
        for (const word of words) {
          if ((lines[lines.length - 1] + word).length > 48) lines.push("")
          lines[lines.length - 1] += `${word} `
        }
        return `<rect x="${x}" y="112" width="592" height="756" rx="14" fill="white" stroke="#cbd5e1" />
        <rect x="${x}" y="112" width="592" height="6" rx="3" fill="${color}" />
        ${text(x + 24, 154, fixture.title, 23, "#0f172a", 700)}
        ${text(x + 490, 154, failed ? "FAIL" : "PASS", 20, color, 700)}
        ${fixture.jsx.map((line, i) => text(x + 24, 190 + i * 23, line, 16, "#334155")).join("")}
        ${pcb}
        ${members
          .map((member, i) => {
            const y = 608 + i * 38
            return `${text(x + 24, y, member.name, 18, "#334155", 700)}
            <rect x="${x + 70}" y="${y - 15}" width="${member.length * 10}" height="16" rx="3" fill="${member.name === "D1" ? color : "#64748b"}" />
            ${text(x + 392, y, `${member.length.toFixed(2)} mm`, 18, "#0f172a", 700)}`
          })
          .join("")}
        ${text(x + 24, 685, fixture.comparison, 19, color, 700)}
        <rect x="${x + 16}" y="705" width="560" height="143" rx="8" fill="${failed ? "#fef2f2" : "#ecfdf5"}" />
        ${text(x + 30, 734, `${fixture.errors.length} ${fixture.errors.length === 1 ? "ERROR" : "ERRORS"} RETURNED`, 15, color, 700)}
        ${lines.map((line, i) => text(x + 30, 763 + 23 * i, line.trim(), 17, "#1e293b")).join("")}
        ${failed ? text(x + 30, 830, fixture.errors[0].type, 14, color) : text(x + 30, 830, "Inclusive limit: equality is allowed.", 14, color)}
      `
      })
      .join("")}
  </svg>`
}
