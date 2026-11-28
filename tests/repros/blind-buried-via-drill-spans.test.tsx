import { expect, test } from "bun:test"
import { cju } from "@tscircuit/circuit-json-util"
import { checkDifferentNetViaSpacing } from "lib/check-different-net-via-spacing"
import { checkSameNetViaSpacing } from "lib/check-same-net-via-spacing"
import { runAllRoutingChecks } from "lib/run-all-checks"
import { Circuit } from "tscircuit"
import { normalizeFixtureSourcePorts } from "../fixtures/normalize-fixture-source-ports"

test("blind and buried vias on disjoint layer spans do not trigger false drill or copper spacing errors", async () => {
  const circuit = new Circuit({
    platform: { placementDrcChecksDisabled: true },
  })
  circuit.add(
    <board
      width={6}
      height={4}
      layers={4}
      routingDisabled
      schematicDisabled
      allowBlindAndBuriedVias
    >
      <via
        name="V_DIFF_TOP"
        pcbX={-1.5}
        pcbY={0}
        outerDiameter={0.4}
        holeDiameter={0.2}
        fromLayer="top"
        toLayer="inner1"
        connectsTo="net.SIG_A"
      />
      <via
        name="V_DIFF_BOT"
        pcbX={-1.5}
        pcbY={0}
        outerDiameter={0.4}
        holeDiameter={0.2}
        fromLayer="inner2"
        toLayer="bottom"
        connectsTo="net.SIG_B"
      />
      <via
        name="V_SAME_TOP"
        pcbX={1.5}
        pcbY={0}
        outerDiameter={0.4}
        holeDiameter={0.2}
        fromLayer="top"
        toLayer="inner1"
        connectsTo="net.GND"
      />
      <via
        name="V_SAME_BOT"
        pcbX={1.7}
        pcbY={0}
        outerDiameter={0.4}
        holeDiameter={0.2}
        fromLayer="inner2"
        toLayer="bottom"
        connectsTo="net.GND"
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = normalizeFixtureSourcePorts(circuit.getCircuitJson())

  expect(checkDifferentNetViaSpacing(circuitJson)).toEqual([])
  expect(checkSameNetViaSpacing(circuitJson)).toEqual([])
  const routingErrors = await runAllRoutingChecks(circuitJson)
  expect(cju(routingErrors).pcb_via_clearance_error.list()).toEqual([])
})

test("blind and buried vias sharing an inner layer still report same-net and different-net spacing violations", async () => {
  const circuit = new Circuit({
    platform: { placementDrcChecksDisabled: true },
  })
  circuit.add(
    <board
      width={6}
      height={4}
      layers={4}
      routingDisabled
      schematicDisabled
      allowBlindAndBuriedVias
    >
      <via
        name="V_DIFF_UPPER"
        pcbX={-1.5}
        pcbY={0}
        outerDiameter={0.4}
        holeDiameter={0.2}
        fromLayer="top"
        toLayer="inner1"
        connectsTo="net.SIG_A"
      />
      <via
        name="V_DIFF_BURIED"
        pcbX={-1.25}
        pcbY={0}
        outerDiameter={0.4}
        holeDiameter={0.2}
        fromLayer="inner1"
        toLayer="inner2"
        connectsTo="net.SIG_B"
      />
      <via
        name="V_SAME_UPPER"
        pcbX={1.5}
        pcbY={0}
        outerDiameter={0.4}
        holeDiameter={0.2}
        fromLayer="top"
        toLayer="inner1"
        connectsTo="net.GND"
      />
      <via
        name="V_SAME_BURIED"
        pcbX={1.7}
        pcbY={0}
        outerDiameter={0.4}
        holeDiameter={0.2}
        fromLayer="inner1"
        toLayer="inner2"
        connectsTo="net.GND"
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  const circuitJson = normalizeFixtureSourcePorts(circuit.getCircuitJson())

  expect(checkDifferentNetViaSpacing(circuitJson)).toHaveLength(1)
  expect(checkSameNetViaSpacing(circuitJson)).toHaveLength(1)
})
