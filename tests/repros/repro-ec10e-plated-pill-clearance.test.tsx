import { expect, test } from "bun:test"
import type { ChipProps } from "@tscircuit/props"
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

const EC10E1220505 = (props: ChipProps<typeof pinLabels>) => {
  return (
    <chip
      pinLabels={pinLabels}
      symbol={
        <symbol>
          <schematiccircle
            center={{ x: -0.1, y: -0.3 }}
            radius={0.05}
            color="#880000"
          />
          <schematiccircle
            center={{ x: -0.5, y: -0.3 }}
            radius={0.05}
            color="#880000"
          />
          <schematicpath
            points={[
              { x: -0.06, y: -0.18 },
              { x: -0.53, y: -0.24 },
            ]}
            strokeColor="#880000"
          />
          <schematiccircle
            center={{ x: -0.1, y: 0.1 }}
            radius={0.05}
            color="#880000"
          />
          <schematiccircle
            center={{ x: -0.5, y: 0.1 }}
            radius={0.05}
            color="#880000"
          />
          <schematicpath
            points={[
              { x: -0.06, y: 0.22 },
              { x: -0.53, y: 0.16 },
            ]}
            strokeColor="#880000"
          />
          <schematicpath
            points={[
              { x: -0.04, y: 0.1 },
              { x: 0.3, y: 0.1 },
              { x: 0.3, y: -0.3 },
              { x: -0.04, y: -0.3 },
            ]}
            strokeColor="#880000"
          />
          <schematicpath
            points={[
              { x: 0.3, y: -0.1 },
              { x: 0.7, y: -0.1 },
            ]}
            strokeColor="#880000"
          />
          <schematicpath
            points={[
              { x: -0.56, y: 0.1 },
              { x: -0.7, y: 0.1 },
            ]}
            strokeColor="#880000"
          />
          <schematicpath
            points={[
              { x: -0.56, y: -0.3 },
              { x: -0.7, y: -0.3 },
            ]}
            strokeColor="#880000"
          />
          <schematicpath
            points={[
              { x: 0.5, y: -0.1 },
              { x: 0.5, y: -0.22 },
            ]}
            strokeColor="#880000"
          />
          <schematicpath
            points={[
              { x: 0.42, y: -0.22 },
              { x: 0.58, y: -0.22 },
            ]}
            strokeColor="#880000"
          />
          <schematicpath
            points={[
              { x: 0.44, y: -0.22 },
              { x: 0.4, y: -0.26 },
            ]}
            strokeColor="#880000"
          />
          <schematicpath
            points={[
              { x: 0.48, y: -0.22 },
              { x: 0.44, y: -0.26 },
            ]}
            strokeColor="#880000"
          />
          <schematicpath
            points={[
              { x: 0.52, y: -0.22 },
              { x: 0.48, y: -0.26 },
            ]}
            strokeColor="#880000"
          />
          <schematicpath
            points={[
              { x: 0.56, y: -0.22 },
              { x: 0.52, y: -0.26 },
            ]}
            strokeColor="#880000"
          />
          <port
            name="pin6"
            pinNumber={6}
            aliases={["A"]}
            direction="left"
            schX={-0.9}
            schY={-0.3}
            schStemLength={0.2}
          />
          <port
            name="pin7"
            pinNumber={7}
            aliases={["B"]}
            direction="left"
            schX={-0.9}
            schY={0.1}
            schStemLength={0.2}
          />
          <port
            name="pin8"
            pinNumber={8}
            aliases={["C"]}
            direction="right"
            schX={0.9}
            schY={-0.1}
            schStemLength={0.2}
          />
          <port
            name="pin4"
            pinNumber={4}
            aliases={["4"]}
            direction="left"
            schX={-0.9}
            schY={-0.5}
            schStemLength={0.4}
          />
          <port
            name="pin5"
            pinNumber={5}
            aliases={["5"]}
            direction="right"
            schX={0.9}
            schY={-0.5}
            schStemLength={0.4}
          />
          <schematicpath
            points={[
              { x: -0.5, y: -0.5 },
              { x: 0.5, y: -0.5 },
            ]}
            strokeColor="#880000"
          />
        </symbol>
      }
      supplierPartNumbers={{
        jlcpcb: ["C160888"],
      }}
      manufacturerPartNumber="EC10E1220505"
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
          <silkscreentext
            text="{NAME}"
            pcbX="-0.000127mm"
            pcbY="4.9903971mm"
            anchorAlignment="center"
            fontSize="1mm"
          />
          <courtyardoutline
            outline={[
              { x: -6.269927000000052, y: 4.240397099999882 },
              { x: 6.269673000000012, y: 4.240397099999882 },
              { x: 6.269673000000012, y: -2.6350029000001314 },
              { x: -6.269927000000052, y: -2.6350029000001314 },
              { x: -6.269927000000052, y: 4.240397099999882 },
            ]}
          />
        </footprint>
      }
      cadModel={{
        objUrl:
          "https://modelcdn.tscircuit.com/easyeda_models/assets/C160888.obj?uuid=771d2bceafb04a13b79f73207623ee7d",
        stepUrl:
          "https://modelcdn.tscircuit.com/easyeda_models/assets/C160888.step?uuid=771d2bceafb04a13b79f73207623ee7d",
        pcbRotationOffset: 180,
        modelOriginPosition: {
          x: 0.000012700000070253736,
          y: 0.7549983999999585,
          z: -0.0729839999999995,
        },
      }}
      {...props}
    />
  )
}

test("reproduces false EC10E1220505 plated-pill clearance errors", async () => {
  const circuit = new Circuit({
    platform: {
      netlistDrcChecksDisabled: true,
      placementDrcChecksDisabled: true,
    },
  })

  circuit.add(
    <board width="12mm" height="14mm">
      <EC10E1220505 name="ENC_WHEEL" pcbRotation={90} />
    </board>,
  )
  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()
  const errors = checkPadPadClearance(circuitJson)

  expect(errors).toHaveLength(2)
  expect(errors.every((error) => error.actual_clearance === 0)).toBe(true)
  expect(
    convertCircuitJsonToPcbSvg([...circuitJson, ...errors], {
      shouldDrawErrors: true,
      showErrorsInTextOverlay: true,
    }),
  ).toMatchSvgSnapshot(import.meta.path)
})
