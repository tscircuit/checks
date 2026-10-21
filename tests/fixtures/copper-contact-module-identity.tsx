import { Circuit } from "@tscircuit/core"

// Reduced from rp2040-bldc-motor-controller-new v0.3.87:
// https://tscircuit.com/MustafaMulla29/rp2040-bldc-motor-controller-new
// Preserve compact_GND_6_run_1, its starting via, and the filled outer contour
// of bottom GND pour pcb_copper_pour_15. The MOTOR_SPEED via recreates its hole.
// Only the surrounding board and unrelated copper have been removed.
export default function CopperContactRepro() {
  return (
    <board
      width={7}
      height={4}
      outlineOffsetX={-15}
      outlineOffsetY={-23.5}
      layers={4}
    >
      <net name="GND" />
      <net name="MOTOR_SPEED" />
      <via
        name="GND_VIA"
        pcbX={-15.9}
        pcbY={-22.9}
        holeDiameter={0.3}
        outerDiameter={0.45}
        connectsTo="net.GND"
      />
      <via
        name="MOTOR_SPEED_VIA"
        pcbX={-16.4}
        pcbY={-23.5}
        holeDiameter={0.3}
        outerDiameter={0.45}
        connectsTo="net.MOTOR_SPEED"
      />
      <trace
        from=".GND_VIA > .bottom"
        to="net.GND"
        thickness={0.2}
        pcbPathRelativeTo=".GND_VIA > .bottom"
        pcbPath={[
          { x: 0, y: -1 },
          { x: -0.155891, y: -1.155891 },
        ]}
      />
      <copperpour
        name="GROUND_BOTTOM"
        layer="bottom"
        connectsTo="net.GND"
        clearance={0.25}
        boardEdgeMargin={0}
        useThermalReliefs={false}
        outline={[
          { x: -12.824264, y: -24.1 },
          { x: -17.075736, y: -24.1 },
          { x: -17.2, y: -23.975736 },
          { x: -17.2, y: -23.624264 },
          { x: -16.987868, y: -23.412132 },
          { x: -16.950559, y: -23.366671 },
          { x: -16.922836, y: -23.314805 },
          { x: -16.905764, y: -23.258527 },
          { x: -16.9, y: -23.2 },
          { x: -16.9, y: -22.981655 },
          { x: -16.858527, y: -22.994236 },
          { x: -16.8, y: -23 },
          { x: -16.741473, y: -22.994236 },
          { x: -16.685195, y: -22.977164 },
          { x: -16.633329, y: -22.949441 },
          { x: -16.587868, y: -22.912132 },
          { x: -16.550559, y: -22.866671 },
          { x: -16.522836, y: -22.814805 },
          { x: -16.505764, y: -22.758527 },
          { x: -16.504283, y: -22.743488 },
          { x: -16.503192, y: -22.743648 },
          { x: -16.447621, y: -22.365767 },
          { x: -16.415118, y: -22.326161 },
          { x: -16.394948, y: -22.363896 },
          { x: -16.335876, y: -22.435876 },
          { x: -16.263896, y: -22.494948 },
          { x: -16.181775, y: -22.538843 },
          { x: -16.092668, y: -22.565873 },
          { x: -16, y: -22.575 },
          { x: -15.907332, y: -22.565873 },
          { x: -15.818225, y: -22.538843 },
          { x: -15.736104, y: -22.494948 },
          { x: -15.664124, y: -22.435876 },
          { x: -15.631789, y: -22.396475 },
          { x: -15.631789, y: -23.148705 },
          { x: -15.626025, y: -23.207232 },
          { x: -15.608953, y: -23.26351 },
          { x: -15.58123, y: -23.315376 },
          { x: -15.543921, y: -23.360837 },
          { x: -15.31017, y: -23.594588 },
          { x: -15.264709, y: -23.631897 },
          { x: -15.212843, y: -23.65962 },
          { x: -15.156565, y: -23.676692 },
          { x: -15.098038, y: -23.682456 },
          { x: -14.394994, y: -23.682456 },
          { x: -12.40672, y: -23.682456 },
        ]}
      />
    </board>
  )
}

export async function renderRepro() {
  const circuit = new Circuit()
  circuit.add(<CopperContactRepro />)
  await circuit.renderUntilSettled()
  return circuit.getCircuitJson()
}
