import { expect, test } from "bun:test"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { runAllNetlistChecks } from "../../lib/run-all-checks"

const SameNetPushbutton = ({
  errorCount,
  errorMessage,
}: { errorCount?: number; errorMessage?: string }) => (
  <board routingDisabled schMaxTraceDistance={1}>
    <pushbutton
      name="SW1"
      footprint="pushbutton_id1.3mm_od2mm"
      connections={{
        pin1: "net.WAKE_MR_N",
        pin2: "net.WAKE_MR_N",
        pin3: "net.GND",
        pin4: "net.GND",
      }}
    />
    {errorCount !== undefined && (
      <schematictext
        text={`SW1 same-net DRC errors: ${errorCount}`}
        schY={-1.5}
        fontSize={0.18}
      />
    )}
    {errorMessage && (
      <schematictext
        text={errorMessage}
        schY={-2.2}
        fontSize={0.12}
        color="red"
      />
    )}
  </board>
)

test("pushbutton same-net DRC is visible in the schematic", async () => {
  const circuit = new Circuit()
  circuit.add(<SameNetPushbutton />)
  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()
  const errors = await runAllNetlistChecks(circuitJson)
  const annotatedCircuit = new Circuit()
  annotatedCircuit.add(
    <SameNetPushbutton
      errorCount={errors.length}
      errorMessage={errors[0]?.message}
    />,
  )
  await annotatedCircuit.renderUntilSettled()

  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    type: "source_component_misconfigured_error",
    is_fatal: true,
  })
  expect(
    convertCircuitJsonToSchematicSvg([
      ...annotatedCircuit.getCircuitJson(),
      ...errors,
    ]),
  ).toMatchSvgSnapshot(import.meta.path)
})
