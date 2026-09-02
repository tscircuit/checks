import { expect, test } from "bun:test"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { checkPadPadClearance } from "../../lib/check-pad-pad-clearance"

const pinLabels = {
  pin4: ["pin4"],
  pin5: ["pin5"],
  pin6: ["A"],
  pin7: ["B"],
  pin8: ["C"],
} as const

const EC10E1220505 = () => (
  <chip
    name="ENC1"
    manufacturerPartNumber="EC10E1220505"
    pinLabels={pinLabels}
    pcbRotation={90}
    footprint={
      <footprint>
        <platedhole
          portHints={["pin6"]}
          pcbX="-2.499995mm"
          pcbY="-0.5749989mm"
          outerDiameter="1.7999964mm"
          holeDiameter="1.1999976mm"
          shape="circle"
        />
        <platedhole
          portHints={["pin7"]}
          pcbX="-0.000127mm"
          pcbY="-0.5749989mm"
          outerDiameter="1.7999964mm"
          holeDiameter="1.1999976mm"
          shape="circle"
        />
        <platedhole
          portHints={["pin8"]}
          pcbX="2.499995mm"
          pcbY="-0.5749989mm"
          outerDiameter="1.7999964mm"
          holeDiameter="1.1999976mm"
          shape="circle"
        />
        <platedhole
          portHints={["pin4"]}
          pcbX="-4.499991mm"
          pcbY="1.4249971mm"
          holeWidth="2.3999952mm"
          holeHeight="2.1999956mm"
          outerWidth="3.1999936mm"
          outerHeight="2.999994mm"
          pcbRotation="90deg"
          shape="pill"
        />
        <platedhole
          portHints={["pin5"]}
          pcbX="4.499991mm"
          pcbY="1.4249971mm"
          holeWidth="2.3999952mm"
          holeHeight="2.1999956mm"
          outerWidth="3.1999936mm"
          outerHeight="2.999994mm"
          pcbRotation="90deg"
          shape="pill"
        />
        <silkscreenpath
          route={[
            { x: -4.900117200000068, y: -2.274995499999932 },
            { x: 4.899863199999913, y: -2.274995499999932 },
          ]}
        />
        <silkscreenpath
          route={[
            { x: 4.899863199999913, y: 3.8249668999999358 },
            { x: -4.900117200000068, y: 3.8249923000000763 },
          ]}
        />
        <silkscreenpath
          route={[
            { x: -4.900117200000068, y: 3.8249923000000763 },
            { x: -4.900117200000068, y: 3.209194699999898 },
          ]}
        />
        <silkscreenpath
          route={[
            { x: -4.900117200000068, y: -0.359200499999929 },
            { x: -4.900117200000068, y: -2.274995499999932 },
          ]}
        />
        <silkscreenpath
          route={[
            { x: 4.899863199999913, y: 3.8249668999999358 },
            { x: 4.899863199999913, y: 3.209245499999952 },
          ]}
        />
        <silkscreenpath
          route={[
            { x: 4.899863199999913, y: -0.3592513000000963 },
            { x: 4.899863199999913, y: -2.274995499999932 },
          ]}
        />
      </footprint>
    }
  />
)

test("EC10E1220505 plated mounting pills do not overlap its signal pads", async () => {
  const circuit = new Circuit({
    platform: {
      netlistDrcChecksDisabled: true,
      placementDrcChecksDisabled: true,
    },
  })

  circuit.add(
    <board width="12mm" height="14mm">
      <EC10E1220505 />
    </board>,
  )
  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()
  const errors = checkPadPadClearance(circuitJson)

  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
  expect(errors).toHaveLength(0)
})
