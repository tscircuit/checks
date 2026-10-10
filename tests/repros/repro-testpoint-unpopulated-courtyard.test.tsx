import { expect, test } from "bun:test"
import { Circuit } from "tscircuit"
import { checkTestPointAccessibility } from "lib/check-testpoint-accessibility"
import { runAllPlacementChecks } from "lib/run-all-checks"

test.each([false, true])(
  "test point access follows whether its covering component is populated (doNotPlace=%s)",
  async (doNotPlace) => {
    const circuit = new Circuit({
      platform: {
        netlistDrcChecksDisabled: true,
        placementDrcChecksDisabled: true,
      },
    })
    circuit.add(
      <board width={20} height={20} routingDisabled>
        <chip
          name="U1"
          pcbX={0}
          pcbY={0}
          doNotPlace={doNotPlace}
          pinLabels={{ 1: "A" }}
          footprint={
            <footprint>
              <smtpad
                portHints={["pin1"]}
                shape="rect"
                width={0.5}
                height={0.5}
                pcbX={-2}
              />
              <courtyardrect width={6} height={4} />
            </footprint>
          }
        />
        <testpoint name="TP1" footprintVariant="pad" padDiameter={1} pcbX={1} />
      </board>,
    )
    await circuit.renderUntilSettled()
    const circuitJson = circuit.getCircuitJson()
    const sourceComponent = circuitJson.find(
      (element) => element.type === "source_component" && element.name === "U1",
    )
    if (!sourceComponent || sourceComponent.type !== "source_component") {
      throw new Error("Expected rendered U1 source component")
    }
    expect(
      circuitJson.find(
        (element) =>
          element.type === "pcb_component" &&
          element.source_component_id === sourceComponent.source_component_id,
      ),
    ).toMatchObject({ do_not_place: doNotPlace })

    const errors = checkTestPointAccessibility(circuitJson)
    expect(errors).toHaveLength(doNotPlace ? 0 : 1)
    if (!doNotPlace) {
      expect(errors[0].message).toBe(
        "Test point TP1 is not accessible because it is inside the courtyard of U1",
      )
    }

    const placementErrors = await runAllPlacementChecks(circuitJson)
    expect(
      placementErrors.filter((error) =>
        error.message.includes("not accessible"),
      ),
    ).toHaveLength(doNotPlace ? 0 : 1)
  },
)
