import { Circuit } from "@tscircuit/core"
import { Fragment } from "react"

export const outline = [
  { x: -25, y: 26 },
  { x: 50, y: 26 },
  { x: 50, y: -29 },
  { x: -25, y: -29 },
]

// Native lands from the AM3352 board; see connector-explicit-outline.md.
export function MicroSdFootprint({ explicit = false }) {
  return (
    <footprint insertionDirection={explicit ? "from_bottom" : undefined}>
      <courtyardrect pcbX={0.03} pcbY={-0.03} width={15.7} height={17.7} />
      {[
        [1, 2.775, 7.725, 0.7, 1.2],
        [2, 1.675, 7.725, 0.7, 1.2],
        [3, 0.575, 7.725, 0.7, 1.2],
        [4, -0.525, 7.725, 0.7, 1.2],
        [5, -1.625, 7.725, 0.7, 1.2],
        [6, -2.725, 7.725, 0.7, 1.2],
        [7, -3.825, 7.725, 0.7, 1.2],
        [8, -4.925, 7.725, 0.7, 1.2],
        [9, -5.875, 7.725, 0.7, 1.2],
        [10, -6.825, -2.775, 1, 0.8],
        [11, -6.825, 3.425, 1, 1.2],
        [11, -6.825, -6.925, 1, 2.8],
        [11, 4.325, 7.725, 1, 1.2],
        [11, 6.675, -7.375, 1.3, 1.9],
      ].map(([pin, x, y, width, height], i) => (
        <Fragment key={i}>
          <smtpad
            portHints={[`pin${pin}`]}
            shape="rect"
            pcbX={x}
            pcbY={y}
            width={width}
            height={height}
          />
        </Fragment>
      ))}
    </footprint>
  )
}

export function HdmiFootprint({ explicit = false }) {
  return (
    <footprint insertionDirection={explicit ? "from_right" : undefined}>
      <courtyardrect pcbX={1.605} width={13.85} height={17} />
      {Array.from({ length: 19 }, (_, i) => (
        <Fragment key={i}>
          <smtpad
            portHints={[`pin${i + 1}`]}
            shape="rect"
            pcbX={-3.285}
            pcbY={4.5 - i * 0.5}
            width={2.6}
            height={0.3}
            solderMaskMargin={0.05}
          />
        </Fragment>
      ))}
      {[
        [20, -2.525, 7.25, 3.3, 2.7],
        [21, -2.525, -7.25, 3.3, 2.7],
        [22, 3.435, 7.25, 2.3, 1.7],
        [23, 3.435, -7.25, 2.3, 1.7],
      ].map(([pin, x, y, outerWidth, holeWidth]) => (
        <Fragment key={pin}>
          <platedhole
            portHints={[`pin${pin}`]}
            shape="pill"
            pcbX={x}
            pcbY={y}
            outerWidth={outerWidth}
            outerHeight={1.5}
            holeWidth={holeWidth}
            holeHeight={0.9}
          />
        </Fragment>
      ))}
    </footprint>
  )
}

export async function renderConnectorOutlineRepro(explicit = false) {
  const circuit = new Circuit()
  circuit.add(
    <board
      width={75}
      height={55}
      layers={8}
      thickness={1.2}
      outline={outline}
      routingDisabled
      schematicDisabled
    >
      <chip
        name="J_MICROSD"
        pcbX={-16.4}
        pcbY={-17.5}
        pcbRotation={270}
        footprint={<MicroSdFootprint explicit={explicit} />}
      />
      <chip
        name="J_HDMI"
        pcbX={44.625}
        pcbY={-20}
        pcbRotation={0}
        footprint={<HdmiFootprint explicit={explicit} />}
      />
      <pcbnotetext
        text="J_MICROSD / opens left"
        pcbX={-12}
        pcbY={-6}
        fontSize={1.7}
      />
      <pcbnotetext
        text="J_HDMI / opens right"
        pcbX={36}
        pcbY={-8}
        fontSize={1.7}
      />
      <pcbnotetext
        text="Actual outline: x -25..50, y -29..26"
        pcbX={12.5}
        pcbY={20}
        fontSize={1.8}
      />
      <pcbnotetext
        text="microSD: left 8.6 mm; bottom 11.5 mm"
        pcbX={12.5}
        pcbY={16}
        fontSize={1.8}
      />
      <pcbnotetext
        text="Nominal rectangle: left 21.1 mm; bottom 10 mm"
        pcbX={12.5}
        pcbY={12}
        fontSize={1.8}
      />
    </board>,
  )
  await circuit.renderUntilSettled()
  return circuit.getCircuitJson()
}
