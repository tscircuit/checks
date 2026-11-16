// TI SLVUCP9B, figure 5-5, page 42.
// TI layout with documented native-symbol spacing/alignment adjustments.
import { netSelector } from "./net-selector"

export function PortProtection() {
  return (
    <schematicsheet
      name="port-protection"
      displayName="TPD4S201 Protection"
      sheetIndex={5}
      sheetWidth={432.46}
      sheetHeight={280.53}
    >
      <chip
        name="U12"
        schX={-6.39012}
        schY={1.57039}
        pinLabels={{
          pin1: "C_SBU1",
          pin2: "C_SBU2",
          pin4: "C_CC1",
          pin5: "C_CC2",
          pin7: "RPD_G1",
          pin6: "RPD_G2",
          pin12: "CC1",
          pin11: "CC2",
          pin15: "SBU1",
          pin14: "SBU2",
          pin9: "FLT",
          pin21: "Thermal_Pad",
          pin3: "VBIAS",
          pin10: "VPWR",
          pin16: "NC",
          pin17: "NC",
          pin19: "NC",
          pin20: "NC",
          pin8: "GND",
          pin13: "GND",
          pin18: "GND",
        }}
        schPinArrangement={{
          leftSide: {
            pins: [
              "pin10",
              "pin3",
              "pin16",
              "pin12",
              "pin11",
              "pin15",
              "pin14",
              "pin9",
            ],
            direction: "top-to-bottom",
          },
          rightSide: {
            pins: [
              "pin21",
              "pin18",
              "pin13",
              "pin8",
              "pin2",
              "pin1",
              "pin6",
              "pin5",
              "pin7",
              "pin4",
              "pin17",
              "pin19",
              "pin20",
            ],
            direction: "bottom-to-top",
          },
        }}
        schPinStyle={{
          pin10: { topMargin: 0.40107 },
          pin3: { topMargin: 0.20012 },
          pin16: { topMargin: 1.00041 },
          pin12: { topMargin: 1.00036 },
          pin11: { topMargin: 1.00041 },
          pin15: { topMargin: 1.00042 },
          pin14: { topMargin: 0.20012 },
          pin9: { topMargin: 2.20077, bottomMargin: 0 },
          pin21: { bottomMargin: 0 },
          pin18: { bottomMargin: 0.20012 },
          pin13: { bottomMargin: 0.20018 },
          pin8: { bottomMargin: 0.20012 },
          pin2: { bottomMargin: 1.00035 },
          pin1: { bottomMargin: 0.20012 },
          pin6: { bottomMargin: 0.6003 },
          pin5: { bottomMargin: 0.20012 },
          pin7: { bottomMargin: 0.60023 },
          pin4: { bottomMargin: 0.20018 },
          pin17: { bottomMargin: 1.00036 },
          pin19: { bottomMargin: 0.60029 },
          pin20: { bottomMargin: 0.60024, topMargin: 0.40107 },
        }}
        schWidth={6.79947}
        schHeight={9.20297}
        pinAttributes={{
          pin1: { isBidirectional: true },
          pin2: { isBidirectional: true },
          pin3: { isPassive: true },
          pin4: { isBidirectional: true },
          pin5: { isBidirectional: true },
          pin6: { isPassive: true },
          pin7: { isPassive: true },
          pin8: { requiresGround: true },
          pin9: {
            isOutput: true,
            canUseOpenDrain: true,
            isUsingOpenDrain: true,
          },
          pin10: { requiresPower: true, shouldHaveDecouplingCapacitor: true },
          pin11: { isBidirectional: true },
          pin12: { isBidirectional: true },
          pin13: { requiresGround: true },
          pin14: { isBidirectional: true },
          pin15: { isBidirectional: true },
          pin16: { isPassive: true },
          pin17: { isPassive: true },
          pin18: { requiresGround: true },
          pin19: { isPassive: true },
          pin20: { isPassive: true },
          pin21: { requiresGround: true },
        }}
        manufacturerPartNumber="TPD4S201RUKR"
      />
      <capacitor
        name="C68"
        schX={-14.18962}
        schY={6.37169}
        capacitance="1uF"
        schRotation={270}
        manufacturerPartNumber="GRM155R6YA105KE11D"
      />
      {/* DNP option retained exactly where TI draws it. */}
      <resistor
        name="R114"
        schX={0.20934}
        schY={2.17051}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={0}
        doNotPlace
      />
      {/* DNP option retained exactly where TI draws it. */}
      <resistor
        name="R116"
        schX={0.20934}
        schY={-0.23032}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={0}
        doNotPlace
      />
      <resistor
        name="R113"
        schX={-0.99045}
        schY={2.9706}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={90}
        manufacturerPartNumber="CRCW04020000Z0ED"
      />
      <resistor
        name="R115"
        schX={-0.99045}
        schY={0.56982}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={90}
        manufacturerPartNumber="CRCW04020000Z0ED"
      />
      <resistor
        name="R111"
        schX={-14.18938}
        schY={8.57244}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={90}
        manufacturerPartNumber="CRCW04020000Z0ED"
      />
      {/* DNP option retained exactly where TI draws it. */}
      <resistor
        name="R112"
        schX={-14.98941}
        schY={7.37217}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={0}
        doNotPlace
      />
      <resistor
        name="R117"
        schX={-10.98962}
        schY={-3.8316}
        resistance="10.0kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW020110K0FKED"
      />
      <capacitor
        name="C69"
        schX={-14.58955}
        schY={4.37104}
        capacitance="0.1uF"
        schRotation={270}
        manufacturerPartNumber="C1005X5R1H104K050BB"
      />

      {/* Electrical connections transcribed from TI, including labeled nets. */}
      <trace from="U12.pin9" to="net.TPD_FLT" />
      <trace from="R117.pin1" to="net.TPD_FLT" />
      <trace from="U12.pin3" to="C69.pin1" />
      <trace from="U12.pin1" to={netSelector("751_C_SBU1")} />
      <trace from="U12.pin2" to={netSelector("751_C_SBU2")} />
      <trace from="U12.pin15" to="net.LD1" />
      <trace from="U12.pin14" to="net.LD2" />
      <trace from="U12.pin21" to="net.GND" />
      <trace from="U12.pin8" to="net.GND" />
      <trace from="U12.pin13" to="net.GND" />
      <trace from="U12.pin18" to="net.GND" />
      <trace from="C68.pin2" to="net.GND" />
      <trace from="U12.pin12" to={netSelector("751_CC1")} />
      <trace from="U12.pin11" to={netSelector("751_CC2")} />
      <trace from="U12.pin4" to={netSelector("751_C_CC1")} />
      <trace from="R113.pin2" to={netSelector("751_C_CC1")} />
      <trace from="U12.pin7" to="R114.pin1" />
      <trace from="U12.pin7" to="R113.pin1" />
      <trace from="U12.pin5" to={netSelector("751_C_CC2")} />
      <trace from="R115.pin2" to={netSelector("751_C_CC2")} />
      <trace from="R116.pin2" to="net.GND" />
      <trace from="U12.pin6" to="R116.pin1" />
      <trace from="U12.pin6" to="R115.pin1" />
      <trace from="U12.pin10" to="C68.pin1" />
      <trace from="U12.pin10" to="R111.pin1" />
      <trace from="U12.pin10" to="R112.pin2" />
      <trace from="R117.pin2" to="net.LDO_3V3" />
      <trace from="R114.pin2" to="net.GND" />
      <trace from="R111.pin2" to="net.LDO_3V3" />
      <trace from="R112.pin1" to="net.GPIO3" />
      <trace from="C69.pin2" to="net.GND" />

      {/* Preserve additional TI net aliases through electrical connections. */}
      <trace from="R112.pin1" to="net.TPD_VPWR" />
      <schematictext
        text={"RESISTOR CONFIGURATION"}
        schX={-0.61852}
        schY={12.35216}
        fontSize={1.16036}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"By default R111, R113 and R115 are populated for  "}
        schX={-0.46164}
        schY={10.35365}
        fontSize={0.36012}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"DRP application that requires dead battery resistors  "}
        schX={-0.34496}
        schY={9.95353}
        fontSize={0.36012}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"(Rd) to be present on the CCx lines."}
        schX={-1.62169}
        schY={9.55341}
        fontSize={0.36012}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"For source-only application that does not require dead  "}
        schX={-0.12888}
        schY={8.75318}
        fontSize={0.36012}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"battery resistors (Rd), remove R111, R113 and R115  "}
        schX={-0.34173}
        schY={8.353}
        fontSize={0.36012}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"and populate R112, R114 and R116 with 0Ohm.  "}
        schX={-0.64152}
        schY={7.95288}
        fontSize={0.36012}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"Figure 5-5. TPD4S201 Schematic"}
        schX={0.20764}
        schY={-5.87636}
        fontSize={0.59347}
        anchor="center"
        schRotation={0}
      />
    </schematicsheet>
  )
}
