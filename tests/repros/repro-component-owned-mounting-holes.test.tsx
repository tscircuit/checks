import { expect, test } from "bun:test"
import { Circuit } from "tscircuit"
import { checkPcbComponentOverlap } from "lib/check-pcb-components-overlap/checkPcbComponentOverlap"

test.each(["smtpad", "platedhole", "holes_only"] as const)(
  "checks every mounting hole of a footprint containing %s",
  async (padType) => {
    const circuit = new Circuit({
      platform: {
        netlistDrcChecksDisabled: true,
        placementDrcChecksDisabled: true,
      },
    })
    circuit.add(
      <board width={30} height={20} routingDisabled>
        <chip
          name="J1"
          pcbX={0}
          pcbY={0}
          pinLabels={padType === "holes_only" ? {} : { 1: "A" }}
          footprint={
            <footprint>
              {padType === "smtpad" && (
                <smtpad
                  portHints={["pin1"]}
                  shape="rect"
                  width={0.5}
                  height={0.5}
                  pcbX={-4}
                />
              )}
              {padType === "platedhole" && (
                <platedhole
                  portHints={["pin1"]}
                  shape="circle"
                  holeDiameter={0.3}
                  outerDiameter={0.6}
                  pcbX={-4}
                />
              )}
              <hole diameter={1} pcbX={-2} />
              <hole diameter={1} pcbX={2} />
              <courtyardrect width={10} height={4} />
            </footprint>
          }
        />
        <chip
          name="U1"
          pcbX={2}
          footprint={
            <footprint>
              <courtyardrect width={2} height={2} />
            </footprint>
          }
        />
      </board>,
    )
    await circuit.renderUntilSettled()
    const circuitJson = circuit.getCircuitJson()
    const holes = circuitJson.filter((element) => element.type === "pcb_hole")
    expect(holes).toHaveLength(2)
    expect(holes[0].pcb_component_id).toBe(holes[1].pcb_component_id)
    expect(holes[1].pcb_component_id).toBeDefined()

    const errors = checkPcbComponentOverlap(circuitJson)
    expect(errors).toHaveLength(1)
    expect(errors[0].pcb_hole_ids).toEqual([holes[1].pcb_hole_id])
    expect(errors[0].message).toContain("pcb_courtyard_rect")
    expect(new Set(errors[0].pcb_component_ids).size).toBe(2)

    const ownFootprintOnly = circuitJson.filter(
      (element) =>
        element.type !== "pcb_courtyard_rect" ||
        element.pcb_component_id === holes[0].pcb_component_id,
    )
    expect(checkPcbComponentOverlap(ownFootprintOnly)).toHaveLength(0)
  },
)
