import { expect, test } from "bun:test"
import type { ChipProps } from "@tscircuit/props"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"
import { Circuit } from "tscircuit"
import { runAllChecks, runAllPlacementChecks } from "lib/run-all-checks"

const INCH = 25.4
const BOARD_W = 1.43 * INCH
const BOARD_H = 0.6 * INCH
const BOARD_CENTER_X_IN = 0.565
const BOARD_CENTER_Y_IN = 0.3

const g = (xIn: number, yIn: number) => ({
  x: (xIn - BOARD_CENTER_X_IN) * INCH,
  y: (yIn - BOARD_CENTER_Y_IN) * INCH,
})

const ss34SmaFootprint = "sma_p4.1148mm_pl1.27mm_pw1.471mm"

const inputCap = g(0.265, 0.17795)
const outputCap = g(0.735, 0.41795)
const inductor = g(0.43495, 0.45)
const diode = g(0.654, 0.188)
const controller = g(0.42995, 0.22495)
const rLow = g(0.50235, 0.05)
const rHigh = g(0.70735, 0.05)
const usbC = { x: -14.35, y: 0 }
const cc1 = { x: -9.7, y: 1.25 }
const cc2 = { x: -10, y: -1.75 }
const terminal = g(1.115, 0.3)

const Inductor = (props: any) => {
  return (
    <chip
      {...props}
      footprint={
        <footprint>
          <smtpad
            portHints={["pin1"]}
            pcbX="-3.034919mm"
            pcbY="0mm"
            width="2.350008mm"
            height="3.499993mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin2"]}
            pcbX="3.034919mm"
            pcbY="0mm"
            width="2.350008mm"
            height="3.499993mm"
            shape="rect"
          />
          <silkscreenpath
            route={[
              { x: -3.499967599999991, y: 3.3000187999999753 },
              { x: 3.5000184000000445, y: 3.2999933999999485 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: -3.499967599999991, y: -3.300018800000089 },
              { x: 3.5000184000000445, y: -3.2999933999999485 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: -3.499967599999991, y: 3.3000187999999753 },
              { x: -3.499967599999991, y: 1.9811238000000913 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: -3.499967599999991, y: -1.9811492000000044 },
              { x: -3.499967599999991, y: -3.300018800000089 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: 3.5000184000000445, y: -3.2999933999999485 },
              { x: 3.5000184000000445, y: -1.9811492000000044 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: 3.5000184000000445, y: 1.9811491999998907 },
              { x: 3.5000184000000445, y: 3.2999933999999485 },
            ]}
          />
          <silkscreentext
            text="{NAME}"
            pcbX="-0.003683mm"
            pcbY="4.302mm"
            anchorAlignment="center"
            fontSize="1mm"
          />
          <courtyardoutline
            outline={[
              { x: -4.457382999999936, y: 3.552000000000021 },
              { x: 4.4500170000000026, y: 3.552000000000021 },
              { x: 4.4500170000000026, y: -3.552000000000021 },
              { x: -4.457382999999936, y: -3.552000000000021 },
              { x: -4.457382999999936, y: 3.552000000000021 },
            ]}
          />
        </footprint>
      }
      cadModel={{
        objUrl:
          "https://modelcdn.tscircuit.com/easyeda_models/assets/C167293.obj?uuid=46df42340ef3430fa12c5e85d24545d4",
        stepUrl:
          "https://modelcdn.tscircuit.com/easyeda_models/assets/C167293.step?uuid=46df42340ef3430fa12c5e85d24545d4",
        pcbRotationOffset: 0,
        modelOriginPosition: { x: -0.000025400000140507473, y: 0, z: -0.1 },
      }}
      {...props}
    />
  )
}

const Capacitor1206 = (props: any) => {
  return (
    <chip
      {...props}
      footprint={
        <footprint>
          <smtpad
            portHints={["pin2"]}
            pcbX="1.59258mm"
            pcbY="0mm"
            width="1.485011mm"
            height="1.7279874mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin1"]}
            pcbX="-1.59258mm"
            pcbY="0mm"
            width="1.485011mm"
            height="1.7279874mm"
            shape="rect"
          />
          <silkscreenpath
            route={[
              { x: 2.4111966000000393, y: 1.0926064000000224 },
              { x: 0.9262109999999666, y: 1.0926064000000224 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: 0.9262109999999666, y: -1.0926063999999087 },
              { x: 2.4111966000000393, y: -1.0926063999999087 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: 2.5635965999999826, y: -0.9402063999999655 },
              { x: 2.5635965999999826, y: 0.9402063999999655 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: -2.411196600000153, y: 1.0926064000000224 },
              { x: -0.9262109999999666, y: 1.0926064000000224 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: -0.9262109999999666, y: -1.0926063999999087 },
              { x: -2.411196600000153, y: -1.0926063999999087 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: -2.5635966000000963, y: -0.9402063999999655 },
              { x: -2.5635966000000963, y: 0.9402063999999655 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: 2.4111966000000393, y: -1.092606399999795 },
              { x: 2.5189596734527413, y: -1.0479694734526674 },
              { x: 2.5635965999999826, y: -0.9402063999999655 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: 2.5635965999999826, y: 0.9402063999999655 },
              { x: 2.5189596734527413, y: 1.0479694734527811 },
              { x: 2.4111966000000393, y: 1.092606399999795 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: -2.411196600000153, y: -1.092606399999795 },
              { x: -2.518959673452855, y: -1.0479694734526674 },
              { x: -2.5635966000000963, y: -0.9402063999999655 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: -2.5635966000000963, y: 0.9402063999999655 },
              { x: -2.518959673452855, y: 1.0479694734527811 },
              { x: -2.411196600000153, y: 1.092606399999795 },
            ]}
          />
          <silkscreentext
            text="{NAME}"
            pcbX="0mm"
            pcbY="2.0922mm"
            anchorAlignment="center"
            fontSize="1mm"
          />
          <courtyardoutline
            outline={[
              { x: -2.815400000000068, y: 1.342200000000048 },
              { x: 2.815399999999954, y: 1.342200000000048 },
              { x: 2.815399999999954, y: -1.3421999999999343 },
              { x: -2.815400000000068, y: -1.3421999999999343 },
              { x: -2.815400000000068, y: 1.342200000000048 },
            ]}
          />
        </footprint>
      }
      cadModel={{
        objUrl:
          "https://modelcdn.tscircuit.com/easyeda_models/assets/C6119969.obj?uuid=c6790e9475e1483991d2c64340b24e96",
        stepUrl:
          "https://modelcdn.tscircuit.com/easyeda_models/assets/C6119969.step?uuid=c6790e9475e1483991d2c64340b24e96",
        pcbRotationOffset: 0,
        modelOriginPosition: { x: 0, y: 0, z: -0.65 },
      }}
      {...props}
    />
  )
}

const TerminalConnector = (props: any) => {
  return (
    <chip
      {...props}
      footprint={
        <footprint>
          <platedhole
            portHints={["pin1"]}
            pcbX="-2.49936mm"
            pcbY="0mm"
            outerDiameter="2.499995mm"
            holeDiameter="1.5999968mm"
            shape="circle"
          />
          <platedhole
            portHints={["pin2"]}
            pcbX="2.49936mm"
            pcbY="0mm"
            outerDiameter="2.499995mm"
            holeDiameter="1.5999968mm"
            shape="circle"
          />
          <silkscreenpath
            route={[
              { x: -1.7358867999999887, y: 4.700016000000005 },
              { x: -1.7358867999999887, y: 3.999992000000006 },
              { x: 1.799996400000012, y: 3.999992000000006 },
              { x: 1.799996400000012, y: 4.700016000000005 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: 5.1206399999999945, y: 3.999992000000006 },
              { x: 2.590545999999989, y: 3.999992000000006 },
              { x: 2.590545999999989, y: 4.700016000000005 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: -5.039360000000002, y: 3.9999666000000076 },
              { x: -2.509266000000011, y: 3.9999666000000076 },
              { x: -2.509266000000011, y: 4.700016000000005 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: 4.317999999999998, y: -3.0219141999999835 },
              { x: 5.1206399999999945, y: -3.0219141999999835 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: -0.7620000000000147, y: -3.0219141999999835 },
              { x: 1.0159999999999911, y: -3.0219141999999835 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: -4.064000000000007, y: -3.0219141999999835 },
              { x: -5.039360000000002, y: -3.0219141999999835 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: -5.039360000000002, y: 3.8100000000000023 },
              { x: -5.039360000000002, y: 4.700016000000005 },
              { x: 5.1206399999999945, y: 4.700016000000005 },
              { x: 5.1206399999999945, y: -3.809999999999988 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: -5.039360000000002, y: 3.8100000000000023 },
              { x: -5.039360000000002, y: -3.809999999999988 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: -5.039360000000002, y: -3.809999999999988 },
              { x: 5.1206399999999945, y: -3.809999999999988 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: -4.064000000000007, y: -3.0219141999999835 },
              { x: -3.8911156176384907, y: -3.2025694665678515 },
              { x: -3.6985894364600824, y: -3.362128247473464 },
              { x: -3.4889798223142208, y: -3.4984702610307323 },
              { x: -3.265072152624697, y: -3.609783739358562 },
              { x: -3.029841803166704, y: -3.69458950388605 },
              { x: -2.786414610068661, y: -3.7517606212762615 },
              { x: -2.5380253324363196, y: -3.780537378572717 },
              { x: -2.2879746675637023, y: -3.780537378572717 },
              { x: -2.0395853899313465, y: -3.7517606212762615 },
              { x: -1.7961581968333178, y: -3.69458950388605 },
              { x: -1.560927847375325, y: -3.609783739358562 },
              { x: -1.337020177685801, y: -3.4984702610307323 },
              { x: -1.1274105635399252, y: -3.362128247473464 },
              { x: -0.9348843823615312, y: -3.2025694665678515 },
              { x: -0.7620000000000147, y: -3.0219141999999835 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: 1.0159999999999911, y: -3.0219141999999835 },
              { x: 1.1858443437975268, y: -3.2081204465932984 },
              { x: 1.3765542596544833, y: -3.3728917893208035 },
              { x: 1.5854431484446252, y: -3.5139070350583097 },
              { x: 1.8095683173164616, y: -3.62917965135793 },
              { x: 2.0457724344650217, y: -3.7170857514446283 },
              { x: 2.290728007599796, y: -3.776386970492851 },
              { x: 2.540984259524464, y: -3.8062479109168805 },
              { x: 2.793015740475539, y: -3.8062479109168805 },
              { x: 3.0432719924001788, y: -3.776386970492851 },
              { x: 3.288227565534953, y: -3.7170857514446283 },
              { x: 3.524431682683513, y: -3.62917965135793 },
              { x: 3.7485568515553496, y: -3.5139070350583097 },
              { x: 3.9574457403454915, y: -3.3728917893208035 },
              { x: 4.148155656202448, y: -3.2081204465932984 },
              { x: 4.317999999999998, y: -3.0219141999999835 },
            ]}
          />
          <silkscreentext
            text="{NAME}"
            pcbX="0.00254mm"
            pcbY="5.699mm"
            anchorAlignment="center"
            fontSize="1mm"
          />
          <courtyardoutline
            outline={[
              { x: -5.365560000000002, y: 4.948999999999998 },
              { x: 5.3706399999999945, y: 4.948999999999998 },
              { x: 5.3706399999999945, y: -4.059999999999988 },
              { x: -5.365560000000002, y: -4.059999999999988 },
              { x: -5.365560000000002, y: 4.948999999999998 },
            ]}
          />
        </footprint>
      }
      cadModel={{
        objUrl:
          "https://modelcdn.tscircuit.com/easyeda_models/assets/C8461.obj?uuid=143d9fa9224c42b1b335671b4e9f3d2e",
        stepUrl:
          "https://modelcdn.tscircuit.com/easyeda_models/assets/C8461.step?uuid=143d9fa9224c42b1b335671b4e9f3d2e",
        pcbRotationOffset: 180,
        modelOriginPosition: {
          x: -2.5400000000000142,
          y: 0.009999100000013694,
          z: -0.000006999999999646178,
        },
      }}
      {...props}
    />
  )
}

const USBC = (props: any) => {
  return (
    <chip
      {...props}
      pinAttributes={{
        A4B9: {
          providesPower: true,
          providesVoltage: "5V",
          requiresPower: true,
          requiresVoltage: "5V",
        },
        B4A9: {
          providesPower: true,
          providesVoltage: "5V",
          requiresPower: true,
          requiresVoltage: "5V",
        },
        A1B12: {
          providesGround: true,
          requiresGround: true,
        },
        B1A12: {
          providesGround: true,
          requiresGround: true,
        },
      }}
      supplierPartNumbers={{
        jlcpcb: ["C2765186"],
      }}
      manufacturerPartNumber="TYPE_C_16PIN_2MD_073_"
      footprint={
        <footprint>
          <hole pcbX="-2.889885mm" pcbY="1.05492555mm" diameter="0.700024mm" />
          <hole pcbX="2.890139mm" pcbY="1.05492555mm" diameter="0.700024mm" />
          <platedhole
            portHints={["pin13"]}
            pcbX="-4.324985mm"
            pcbY="1.57511755mm"
            holeWidth="0.5999988mm"
            holeHeight="1.499997mm"
            outerWidth="1.0999978mm"
            outerHeight="1.999996mm"
            shape="pill"
          />
          <platedhole
            portHints={["pin14"]}
            pcbX="4.324985mm"
            pcbY="1.57511755mm"
            holeWidth="0.5999988mm"
            holeHeight="1.499997mm"
            outerWidth="1.0999978mm"
            outerHeight="1.999996mm"
            shape="pill"
          />
          <platedhole
            portHints={["pin15"]}
            pcbX="-4.324985mm"
            pcbY="-2.62502645mm"
            holeWidth="0.5999988mm"
            holeHeight="1.1999976mm"
            outerWidth="1.1999976mm"
            outerHeight="1.7999964mm"
            shape="pill"
          />
          <platedhole
            portHints={["pin16"]}
            pcbX="4.324985mm"
            pcbY="-2.62502645mm"
            holeWidth="0.5999988mm"
            holeHeight="1.1999976mm"
            outerWidth="1.1999976mm"
            outerHeight="1.7999964mm"
            shape="pill"
          />
          <smtpad
            portHints={["pin17"]}
            pcbX="-3.200019mm"
            pcbY="2.12502755mm"
            width="0.5500116mm"
            height="1.0999978mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin18"]}
            pcbX="-2.399919mm"
            pcbY="2.12502755mm"
            width="0.5500116mm"
            height="1.0999978mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin19"]}
            pcbX="-1.749933mm"
            pcbY="2.12502755mm"
            width="0.2999994mm"
            height="1.0999978mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin20"]}
            pcbX="-1.249807mm"
            pcbY="2.12502755mm"
            width="0.2999994mm"
            height="1.0999978mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin21"]}
            pcbX="-0.749935mm"
            pcbY="2.12502755mm"
            width="0.2999994mm"
            height="1.0999978mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin22"]}
            pcbX="-0.250063mm"
            pcbY="2.12502755mm"
            width="0.2999994mm"
            height="1.0999978mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin23"]}
            pcbX="0.250063mm"
            pcbY="2.12502755mm"
            width="0.2999994mm"
            height="1.0999978mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin24"]}
            pcbX="0.749935mm"
            pcbY="2.12502755mm"
            width="0.2999994mm"
            height="1.0999978mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin25"]}
            pcbX="1.250061mm"
            pcbY="2.12502755mm"
            width="0.2999994mm"
            height="1.0999978mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin26"]}
            pcbX="1.750187mm"
            pcbY="2.12502755mm"
            width="0.2999994mm"
            height="1.0999978mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin27"]}
            pcbX="2.400173mm"
            pcbY="2.12502755mm"
            width="0.5500116mm"
            height="1.0999978mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin28"]}
            pcbX="3.200019mm"
            pcbY="2.12502755mm"
            width="0.5500116mm"
            height="1.0999978mm"
            shape="rect"
          />
          <silkscreenpath
            route={[
              { x: 4.5720761999999695, y: -1.646948650000013 },
              { x: 4.5720761999999695, y: 0.34700214999986656 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: 4.5720761999999695, y: -5.0759740500000134 },
              { x: 4.5720761999999695, y: -3.6030026500000076 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: -4.499914800000056, y: -1.6438244500001247 },
              { x: -4.499914800000056, y: 0.34390335000000505 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: -4.499914800000056, y: -5.224970450000114 },
              { x: -4.499914800000056, y: -3.6061268500000097 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: 4.5000671999999895, y: -5.224970450000114 },
              { x: -4.499914800000056, y: -5.224970450000114 },
            ]}
          />
          <silkscreentext
            text="{NAME}"
            pcbX="-0.006731mm"
            pcbY="3.68382755mm"
            anchorAlignment="center"
            fontSize="1mm"
          />
          <courtyardoutline
            outline={[
              { x: -5.184331000000043, y: 2.9338275499999327 },
              { x: 5.170869000000039, y: 2.9338275499999327 },
              { x: 5.170869000000039, y: -5.490972450000072 },
              { x: -5.184331000000043, y: -5.490972450000072 },
              { x: -5.184331000000043, y: 2.9338275499999327 },
            ]}
          />
        </footprint>
      }
      cadModel={{
        objUrl:
          "https://modelcdn.tscircuit.com/easyeda_models/assets/C2765186.obj?uuid=4ee8413127e64716b804db03d4b340ae",
        stepUrl:
          "https://modelcdn.tscircuit.com/easyeda_models/assets/C2765186.step?uuid=4ee8413127e64716b804db03d4b340ae",
        pcbRotationOffset: 0,
        modelOriginPosition: {
          x: -0.000012699999956566899,
          y: 1.5749970500000927,
          z: -1.6800018,
        },
      }}
      {...props}
    />
  )
}

const MT3608 = (props: any) => {
  return (
    <chip
      {...props}
      pinAttributes={{
        IN: {
          requiresPower: true,
          requiresVoltage: "5V",
        },
        EN: {
          requiresPower: true,
          requiresVoltage: "5V",
        },
        GND: {
          requiresGround: true,
        },
        NC: {
          doNotConnect: true,
        },
      }}
      supplierPartNumbers={{
        jlcpcb: ["C84817"],
      }}
      manufacturerPartNumber="MT3608"
      footprint={
        <footprint>
          <smtpad
            portHints={["pin1"]}
            pcbX="-0.94996mm"
            pcbY="-1.149096mm"
            width="0.532003mm"
            height="1.072007mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin2"]}
            pcbX="0mm"
            pcbY="-1.149096mm"
            width="0.532003mm"
            height="1.072007mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin3"]}
            pcbX="0.94996mm"
            pcbY="-1.149096mm"
            width="0.532003mm"
            height="1.072007mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin4"]}
            pcbX="0.94996mm"
            pcbY="1.149096mm"
            width="0.532003mm"
            height="1.072007mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin5"]}
            pcbX="0mm"
            pcbY="1.149096mm"
            width="0.532003mm"
            height="1.072007mm"
            shape="rect"
          />
          <smtpad
            portHints={["pin6"]}
            pcbX="-0.94996mm"
            pcbY="1.149096mm"
            width="0.532003mm"
            height="1.072007mm"
            shape="rect"
          />
          <silkscreenpath
            route={[
              { x: 1.5391891999998961, y: -0.8892031999998835 },
              { x: 1.5391891999998961, y: 0.8892031999999972 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: -1.5391892000000098, y: -0.8892031999998835 },
              { x: -1.5391892000000098, y: 0.8892031999999972 },
            ]}
          />
          <silkscreenpath
            route={[
              { x: -1.518158000000085, y: -1.3014960000000428 },
              { x: -1.5232730105126393, y: -1.3403483621364103 },
              { x: -1.538269462536391, y: -1.3765529999999444 },
              { x: -1.5621253726490067, y: -1.4076426273509242 },
              { x: -1.5932150000001002, y: -1.4314985374635398 },
              { x: -1.6294196378635206, y: -1.4464949894874053 },
              { x: -1.6682720000001154, y: -1.451609999999846 },
              { x: -1.7071243621367103, y: -1.4464949894874053 },
              { x: -1.7433290000001307, y: -1.4314985374635398 },
              { x: -1.7744186273511104, y: -1.4076426273509242 },
              { x: -1.7982745374637261, y: -1.3765529999999444 },
              { x: -1.8132709894875916, y: -1.3403483621364103 },
              { x: -1.818386000000146, y: -1.3014960000000428 },
              { x: -1.8132709894875916, y: -1.2626436378633343 },
              { x: -1.7982745374637261, y: -1.226438999999914 },
              { x: -1.7744186273511104, y: -1.1953493726489341 },
              { x: -1.7433290000001307, y: -1.1714934625363185 },
              { x: -1.7071243621367103, y: -1.156497010512453 },
              { x: -1.6682720000001154, y: -1.1513819999998987 },
              { x: -1.6294196378635206, y: -1.156497010512453 },
              { x: -1.5932150000001002, y: -1.1714934625363185 },
              { x: -1.5621253726490067, y: -1.1953493726489341 },
              { x: -1.538269462536391, y: -1.226438999999914 },
              { x: -1.5232730105126393, y: -1.2626436378633343 },
              { x: -1.518158000000085, y: -1.3014960000000428 },
            ]}
          />
          <silkscreentext
            text="{NAME}"
            pcbX="-0.1524mm"
            pcbY="2.6764mm"
            anchorAlignment="center"
            fontSize="1mm"
          />
          <courtyardoutline
            outline={[
              { x: -2.078800000000001, y: 1.9264000000000578 },
              { x: 1.7739999999998872, y: 1.9264000000000578 },
              { x: 1.7739999999998872, y: -2.0279999999999063 },
              { x: -2.078800000000001, y: -2.0279999999999063 },
              { x: -2.078800000000001, y: 1.9264000000000578 },
            ]}
          />
        </footprint>
      }
      cadModel={{
        objUrl:
          "https://modelcdn.tscircuit.com/easyeda_models/assets/C84817.obj?uuid=229b69761e2c45dba6a83d8866dec72d",
        stepUrl:
          "https://modelcdn.tscircuit.com/easyeda_models/assets/C84817.step?uuid=229b69761e2c45dba6a83d8866dec72d",
        pcbRotationOffset: 90,
        modelOriginPosition: {
          x: -0.000012700000070253736,
          y: 0.000012700000070253736,
          z: -0.048939,
        },
      }}
      {...props}
    />
  )
}

test("type-c footprint mounting holes inside own courtyard do not cause placement errors", async () => {
  const circuit = new Circuit()

  circuit.add(
    <board
      width={`${BOARD_W}mm`}
      height={`${BOARD_H}mm`}
      layers={2}
      autorouter="auto-local"
      minTraceWidth="0.5mm"
      nominalTraceWidth="0.25mm"
      minTraceToPadEdgeClearance="0.05mm"
      minPadEdgeToPadEdgeClearance="0.05mm"
      minBoardEdgeClearance="0mm"
      pcbStyle={{ silkscreenFontSize: "0.75mm" }}
    >
      <USBC
        name="USB1"
        pcbX={usbC.x}
        pcbY={usbC.y}
        pcbRotation={-90}
        schX={-7}
        schY={0}
        connections={{
          A4B9: "net.V5",
          B4A9: "net.V5",
          A1B12: "net.GND",
          B1A12: "net.GND",
        }}
      />

      <resistor
        name="R_CC1"
        resistance="5.1k"
        manufacturerPartNumber="0402WGF5101TCE"
        supplierPartNumbers={{ jlcpcb: ["C25905"] }}
        footprint="0402"
        pcbX={cc1.x}
        pcbY={cc1.y}
        schX={-5.4}
        schY={-2.5}
        connections={{ pin1: ".USB1 > .A5", pin2: "net.GND" }}
      />

      <resistor
        name="R_CC2"
        resistance="5.1k"
        manufacturerPartNumber="0402WGF5101TCE"
        supplierPartNumbers={{ jlcpcb: ["C25905"] }}
        footprint="0402"
        pcbX={cc2.x}
        pcbY={cc2.y}
        schX={-4.2}
        schY={-2.5}
        connections={{ pin1: ".USB1 > .B5", pin2: "net.GND" }}
      />

      <TerminalConnector
        name="X1"
        manufacturerPartNumber="WJ2EDGV-5.08-2P"
        supplierPartNumbers={{ jlcpcb: ["C8461"] }}
        pcbX={terminal.x}
        pcbY={terminal.y}
        schX={7}
        schY={0}
        pinLabels={{ pin1: "pin1", pin2: "pin2" }}
        connections={{ pin1: "net.VOUT_12V", pin2: "net.GND" }}
        pcbRotation={-270}
      />

      <MT3608
        name="U1"
        manufacturerPartNumber="MT3608"
        pcbRotation={90}
        pcbX={controller.x}
        pcbY={controller.y}
        schX={0}
        schY={0}
        pinLabels={{
          pin1: "SW",
          pin2: "GND",
          pin3: "FB",
          pin4: "EN",
          pin5: "IN",
          pin6: "NC",
        }}
        schPinArrangement={{
          leftSide: { direction: "top-to-bottom", pins: ["SW", "GND", "FB"] },
          rightSide: { direction: "bottom-to-top", pins: ["EN", "IN", "NC"] },
        }}
        connections={{
          SW: "net.SW",
          GND: "net.GND",
          FB: "net.FB",
          EN: "net.V5",
          IN: "net.V5",
        }}
      />

      <Inductor
        name="L1"
        displayName="10uH"
        manufacturerPartNumber="0630CDMCCDS-100MC"
        supplierPartNumbers={{ jlcpcb: ["C167292"] }}
        pcbX={inductor.x}
        pcbY={inductor.y}
        schX={-2.7}
        schY={2.5}
        connections={{ pin1: "net.V5", pin2: "net.SW" }}
      />

      <diode
        name="D1"
        manufacturerPartNumber="SS36"
        supplierPartNumbers={{ jlcpcb: ["C16015"] }}
        footprint={ss34SmaFootprint}
        pcbX={diode.x}
        pcbY={diode.y}
        schX={2.9}
        schY={2.5}
        connections={{ anode: "net.SW", cathode: "net.VOUT_12V" }}
      />

      <Capacitor1206
        name="C1"
        pcbRotation={-90}
        pcbX={inputCap.x}
        pcbY={inputCap.y}
        schX={-4}
        schY={-1.7}
        connections={{ pin1: "net.V5", pin2: "net.GND" }}
      />

      <Capacitor1206
        name="C2"
        pcbRotation={-90}
        pcbX={outputCap.x}
        pcbY={outputCap.y}
        schX={4.3}
        schY={-1.7}
        connections={{ pin1: "net.VOUT_12V", pin2: "net.GND" }}
      />

      <resistor
        name="R1"
        resistance="62k"
        manufacturerPartNumber="0603WAF6202T5E"
        supplierPartNumbers={{ jlcpcb: ["C23221"] }}
        footprint="0603"
        pcbX={rHigh.x}
        pcbY={rHigh.y}
        schX={4.8}
        schY={0.4}
        connections={{ pin1: "net.VOUT_12V", pin2: "net.FB" }}
      />

      <resistor
        name="R2"
        resistance="3.3k"
        manufacturerPartNumber="0603WAF3301T5E"
        supplierPartNumbers={{ jlcpcb: ["C22978"] }}
        footprint="0603"
        pcbX={rLow.x}
        pcbY={rLow.y}
        schX={4.8}
        schY={-1.4}
        connections={{ pin1: "net.FB", pin2: "net.GND" }}
      />
    </board>,
  )

  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()
  const errors = await runAllChecks(circuitJson)

  const pcb_trace_errors = errors.filter(
    (error) => error.type === "pcb_trace_error",
  )
  expect(pcb_trace_errors).toHaveLength(0)
})
