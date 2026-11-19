// TI SLVUCP9B, figure 5-2, page 40.
// TI layout with documented native-symbol spacing/alignment adjustments.
import { netSelector } from "./net-selector"

export function UsbConnectors() {
  return (
    <schematicsheet
      name="usb-connectors"
      displayName="USB Type-C Connectors"
      sheetIndex={2}
      sheetWidth={1050.77}
      sheetHeight={322.56}
    >
      <chip
        name="J2"
        schX={-30.23271}
        schY={9.6113}
        pinLabels={{
          pin1: ["A1_GND", "A1", "GND"],
          pin2: ["A2_SSTXp1", "A2", "SSTXp1"],
          pin3: ["A3_SSTXn1", "A3", "SSTXn1"],
          pin4: ["A4_VBUS", "A4", "VBUS"],
          pin5: ["A5_CC1", "A5", "CC1"],
          pin6: ["A6_Dp1", "A6", "Dp1"],
          pin7: ["A7_Dn1", "A7", "Dn1"],
          pin8: ["A8_SBU1", "A8", "SBU1"],
          pin9: ["A9_VBUS", "A9", "VBUS"],
          pin10: ["A10_SSRXn2", "A10", "SSRXn2"],
          pin11: ["A11_SSRXp2", "A11", "SSRXp2"],
          pin12: ["B12_GND", "B12", "GND"],
          pin13: ["B11_SSRXp1", "B11", "SSRXp1"],
          pin14: ["B10_SSRXn1", "B10", "SSRXn1"],
          pin15: ["B9_VBUS", "B9", "VBUS"],
          pin16: ["B8_SBU2", "B8", "SBU2"],
          pin17: ["B5_CC2", "B5", "CC2"],
          pin18: ["B4_VBUS", "B4", "VBUS"],
          pin19: ["B3_SSTXn2", "B3", "SSTXn2"],
          pin20: ["B2_SSTXp2", "B2", "SSTXp2"],
          pin21: ["B1_GND", "B1", "GND"],
          pin22: ["A12_GND", "A12", "GND"],
          pin23: ["S1_SHIELD", "S1", "SHIELD"],
          pin24: ["S2_SHIELD", "S2", "SHIELD"],
          pin25: ["S3_SHIELD", "S3", "SHIELD"],
          pin26: ["S4_SHIELD", "S4", "SHIELD"],
          pin27: ["B6_Dp2", "B6", "Dp2"],
          pin28: ["B7_Dn2", "B7", "Dn2"],
        }}
        schPinArrangement={{
          leftSide: {
            pins: [
              "pin1",
              "pin2",
              "pin3",
              "pin4",
              "pin5",
              "pin6",
              "pin7",
              "pin8",
              "pin9",
              "pin10",
              "pin11",
              "pin22",
              "pin23",
              "pin24",
            ],
            direction: "top-to-bottom",
          },
          rightSide: {
            pins: [
              "pin26",
              "pin25",
              "pin21",
              "pin20",
              "pin19",
              "pin18",
              "pin17",
              "pin27",
              "pin28",
              "pin16",
              "pin15",
              "pin14",
              "pin13",
              "pin12",
            ],
            direction: "bottom-to-top",
          },
        }}
        schPinStyle={{
          pin1: { topMargin: 0 },
          pin2: { topMargin: 0.20024 },
          pin3: { topMargin: 0.20017 },
          pin4: { topMargin: 0.20024 },
          pin5: { topMargin: 0.20024 },
          pin6: { topMargin: 0.20017 },
          pin7: { topMargin: 0.20023 },
          pin8: { topMargin: 0.20024 },
          pin9: { topMargin: 0.20017 },
          pin10: { topMargin: 0.20024 },
          pin11: { topMargin: 0.20017 },
          pin22: { topMargin: 0.20024 },
          pin23: { topMargin: 0.60041 },
          pin24: { topMargin: 0.20024, bottomMargin: 0 },
          pin26: { bottomMargin: 0 },
          pin25: { bottomMargin: 0.20024 },
          pin21: { bottomMargin: 0.60041 },
          pin20: { bottomMargin: 0.20024 },
          pin19: { bottomMargin: 0.20017 },
          pin18: { bottomMargin: 0.20024 },
          pin17: { bottomMargin: 0.20017 },
          pin27: { bottomMargin: 0.20024 },
          pin28: { bottomMargin: 0.20023 },
          pin16: { bottomMargin: 0.20017 },
          pin15: { bottomMargin: 0.20024 },
          pin14: { bottomMargin: 0.20024 },
          pin13: { bottomMargin: 0.20017 },
          pin12: { bottomMargin: 0.20024, topMargin: 0 },
        }}
        schWidth={5.59941}
        schHeight={6.40334}
        pinAttributes={{
          pin1: { isPassive: true },
          pin2: { isPassive: true },
          pin3: { isPassive: true },
          pin4: { isPassive: true },
          pin5: { isPassive: true },
          pin6: { isPassive: true },
          pin7: { isPassive: true },
          pin8: { isPassive: true },
          pin9: { isPassive: true },
          pin10: { isPassive: true },
          pin11: { isPassive: true },
          pin12: { isPassive: true },
          pin13: { isPassive: true },
          pin14: { isPassive: true },
          pin15: { isPassive: true },
          pin16: { isPassive: true },
          pin17: { isPassive: true },
          pin18: { isPassive: true },
          pin19: { isPassive: true },
          pin20: { isPassive: true },
          pin21: { isPassive: true },
          pin22: { isPassive: true },
          pin23: { isPassive: true },
          pin24: { isPassive: true },
          pin25: { isPassive: true },
          pin26: { isPassive: true },
          pin27: { isPassive: true },
          pin28: { isPassive: true },
        }}
        manufacturerPartNumber="DX07S024JJ2R1300"
      />
      <chip
        name="J3"
        schX={-8.23237}
        schY={9.6113}
        pinLabels={{
          pin1: ["A1_GND", "A1", "GND"],
          pin2: ["A2_SSTXp1", "A2", "SSTXp1"],
          pin3: ["A3_SSTXn1", "A3", "SSTXn1"],
          pin4: ["A4_VBUS", "A4", "VBUS"],
          pin5: ["A5_CC1", "A5", "CC1"],
          pin6: ["A6_Dp1", "A6", "Dp1"],
          pin7: ["A7_Dn1", "A7", "Dn1"],
          pin8: ["A8_SBU1", "A8", "SBU1"],
          pin9: ["A9_VBUS", "A9", "VBUS"],
          pin10: ["A10_SSRXn2", "A10", "SSRXn2"],
          pin11: ["A11_SSRXp2", "A11", "SSRXp2"],
          pin12: ["B12_GND", "B12", "GND"],
          pin13: ["B11_SSRXp1", "B11", "SSRXp1"],
          pin14: ["B10_SSRXn1", "B10", "SSRXn1"],
          pin15: ["B9_VBUS", "B9", "VBUS"],
          pin16: ["B8_SBU2", "B8", "SBU2"],
          pin17: ["B5_CC2", "B5", "CC2"],
          pin18: ["B4_VBUS", "B4", "VBUS"],
          pin19: ["B3_SSTXn2", "B3", "SSTXn2"],
          pin20: ["B2_SSTXp2", "B2", "SSTXp2"],
          pin21: ["B1_GND", "B1", "GND"],
          pin22: ["A12_GND", "A12", "GND"],
          pin23: ["S1_SHIELD", "S1", "SHIELD"],
          pin24: ["S2_SHIELD", "S2", "SHIELD"],
          pin25: ["S3_SHIELD", "S3", "SHIELD"],
          pin26: ["S4_SHIELD", "S4", "SHIELD"],
          pin27: ["B6_Dp2", "B6", "Dp2"],
          pin28: ["B7_Dn2", "B7", "Dn2"],
        }}
        schPinArrangement={{
          leftSide: {
            pins: [
              "pin1",
              "pin2",
              "pin3",
              "pin4",
              "pin5",
              "pin6",
              "pin7",
              "pin8",
              "pin9",
              "pin10",
              "pin11",
              "pin22",
              "pin23",
              "pin24",
            ],
            direction: "top-to-bottom",
          },
          rightSide: {
            pins: [
              "pin26",
              "pin25",
              "pin21",
              "pin20",
              "pin19",
              "pin18",
              "pin17",
              "pin27",
              "pin28",
              "pin16",
              "pin15",
              "pin14",
              "pin13",
              "pin12",
            ],
            direction: "bottom-to-top",
          },
        }}
        schPinStyle={{
          pin1: { topMargin: 0 },
          pin2: { topMargin: 0.20024 },
          pin3: { topMargin: 0.20017 },
          pin4: { topMargin: 0.20024 },
          pin5: { topMargin: 0.20024 },
          pin6: { topMargin: 0.20017 },
          pin7: { topMargin: 0.20023 },
          pin8: { topMargin: 0.20024 },
          pin9: { topMargin: 0.20017 },
          pin10: { topMargin: 0.20024 },
          pin11: { topMargin: 0.20017 },
          pin22: { topMargin: 0.20024 },
          pin23: { topMargin: 0.60041 },
          pin24: { topMargin: 0.20024, bottomMargin: 0 },
          pin26: { bottomMargin: 0 },
          pin25: { bottomMargin: 0.20024 },
          pin21: { bottomMargin: 0.60041 },
          pin20: { bottomMargin: 0.20024 },
          pin19: { bottomMargin: 0.20017 },
          pin18: { bottomMargin: 0.20024 },
          pin17: { bottomMargin: 0.20017 },
          pin27: { bottomMargin: 0.20024 },
          pin28: { bottomMargin: 0.20023 },
          pin16: { bottomMargin: 0.20017 },
          pin15: { bottomMargin: 0.20024 },
          pin14: { bottomMargin: 0.20024 },
          pin13: { bottomMargin: 0.20017 },
          pin12: { bottomMargin: 0.20024, topMargin: 0 },
        }}
        schWidth={5.59855}
        schHeight={6.40334}
        pinAttributes={{
          pin1: { isPassive: true },
          pin2: { isPassive: true },
          pin3: { isPassive: true },
          pin4: { isPassive: true },
          pin5: { isPassive: true },
          pin6: { isPassive: true },
          pin7: { isPassive: true },
          pin8: { isPassive: true },
          pin9: { isPassive: true },
          pin10: { isPassive: true },
          pin11: { isPassive: true },
          pin12: { isPassive: true },
          pin13: { isPassive: true },
          pin14: { isPassive: true },
          pin15: { isPassive: true },
          pin16: { isPassive: true },
          pin17: { isPassive: true },
          pin18: { isPassive: true },
          pin19: { isPassive: true },
          pin20: { isPassive: true },
          pin21: { isPassive: true },
          pin22: { isPassive: true },
          pin23: { isPassive: true },
          pin24: { isPassive: true },
          pin25: { isPassive: true },
          pin26: { isPassive: true },
          pin27: { isPassive: true },
          pin28: { isPassive: true },
        }}
        manufacturerPartNumber="DX07S024JJ2R1300"
      />
      <chip
        name="J4"
        schX={13.36841}
        schY={9.6113}
        pinLabels={{
          pin1: ["A1_GND", "A1", "GND"],
          pin2: ["A2_SSTXp1", "A2", "SSTXp1"],
          pin3: ["A3_SSTXn1", "A3", "SSTXn1"],
          pin4: ["A4_VBUS", "A4", "VBUS"],
          pin5: ["A5_CC1", "A5", "CC1"],
          pin6: ["A6_Dp1", "A6", "Dp1"],
          pin7: ["A7_Dn1", "A7", "Dn1"],
          pin8: ["A8_SBU1", "A8", "SBU1"],
          pin9: ["A9_VBUS", "A9", "VBUS"],
          pin10: ["A10_SSRXn2", "A10", "SSRXn2"],
          pin11: ["A11_SSRXp2", "A11", "SSRXp2"],
          pin12: ["B12_GND", "B12", "GND"],
          pin13: ["B11_SSRXp1", "B11", "SSRXp1"],
          pin14: ["B10_SSRXn1", "B10", "SSRXn1"],
          pin15: ["B9_VBUS", "B9", "VBUS"],
          pin16: ["B8_SBU2", "B8", "SBU2"],
          pin17: ["B5_CC2", "B5", "CC2"],
          pin18: ["B4_VBUS", "B4", "VBUS"],
          pin19: ["B3_SSTXn2", "B3", "SSTXn2"],
          pin20: ["B2_SSTXp2", "B2", "SSTXp2"],
          pin21: ["B1_GND", "B1", "GND"],
          pin22: ["A12_GND", "A12", "GND"],
          pin23: ["S1_SHIELD", "S1", "SHIELD"],
          pin24: ["S2_SHIELD", "S2", "SHIELD"],
          pin25: ["S3_SHIELD", "S3", "SHIELD"],
          pin26: ["S4_SHIELD", "S4", "SHIELD"],
          pin27: ["B6_Dp2", "B6", "Dp2"],
          pin28: ["B7_Dn2", "B7", "Dn2"],
        }}
        schPinArrangement={{
          leftSide: {
            pins: [
              "pin1",
              "pin2",
              "pin3",
              "pin4",
              "pin5",
              "pin6",
              "pin7",
              "pin8",
              "pin9",
              "pin10",
              "pin11",
              "pin22",
              "pin23",
              "pin24",
            ],
            direction: "top-to-bottom",
          },
          rightSide: {
            pins: [
              "pin26",
              "pin25",
              "pin21",
              "pin20",
              "pin19",
              "pin18",
              "pin17",
              "pin27",
              "pin28",
              "pin16",
              "pin15",
              "pin14",
              "pin13",
              "pin12",
            ],
            direction: "bottom-to-top",
          },
        }}
        schPinStyle={{
          pin1: { topMargin: 0 },
          pin2: { topMargin: 0.20024 },
          pin3: { topMargin: 0.20017 },
          pin4: { topMargin: 0.20024 },
          pin5: { topMargin: 0.20024 },
          pin6: { topMargin: 0.20017 },
          pin7: { topMargin: 0.20023 },
          pin8: { topMargin: 0.20024 },
          pin9: { topMargin: 0.20017 },
          pin10: { topMargin: 0.20024 },
          pin11: { topMargin: 0.20017 },
          pin22: { topMargin: 0.20024 },
          pin23: { topMargin: 0.60041 },
          pin24: { topMargin: 0.20024, bottomMargin: 0 },
          pin26: { bottomMargin: 0 },
          pin25: { bottomMargin: 0.20024 },
          pin21: { bottomMargin: 0.60041 },
          pin20: { bottomMargin: 0.20024 },
          pin19: { bottomMargin: 0.20017 },
          pin18: { bottomMargin: 0.20024 },
          pin17: { bottomMargin: 0.20017 },
          pin27: { bottomMargin: 0.20024 },
          pin28: { bottomMargin: 0.20023 },
          pin16: { bottomMargin: 0.20017 },
          pin15: { bottomMargin: 0.20024 },
          pin14: { bottomMargin: 0.20024 },
          pin13: { bottomMargin: 0.20017 },
          pin12: { bottomMargin: 0.20024, topMargin: 0 },
        }}
        schWidth={5.60189}
        schHeight={6.40334}
        pinAttributes={{
          pin1: { isPassive: true },
          pin2: { isPassive: true },
          pin3: { isPassive: true },
          pin4: { isPassive: true },
          pin5: { isPassive: true },
          pin6: { isPassive: true },
          pin7: { isPassive: true },
          pin8: { isPassive: true },
          pin9: { isPassive: true },
          pin10: { isPassive: true },
          pin11: { isPassive: true },
          pin12: { isPassive: true },
          pin13: { isPassive: true },
          pin14: { isPassive: true },
          pin15: { isPassive: true },
          pin16: { isPassive: true },
          pin17: { isPassive: true },
          pin18: { isPassive: true },
          pin19: { isPassive: true },
          pin20: { isPassive: true },
          pin21: { isPassive: true },
          pin22: { isPassive: true },
          pin23: { isPassive: true },
          pin24: { isPassive: true },
          pin25: { isPassive: true },
          pin26: { isPassive: true },
          pin27: { isPassive: true },
          pin28: { isPassive: true },
        }}
        manufacturerPartNumber="DX07S024JJ2R1300"
      />
      <resistor
        name="R23"
        schX={6.56737}
        schY={7.21004}
        resistance="5.10kohm"
        symbolName="resistor"
        schRotation={90}
        manufacturerPartNumber="RC0201FR-075K1L"
      />
      <connector
        name="J5"
        schX={-34.03246}
        schY={-2.99454}
        pinLabels={{
          pin1: "BAT",
          pin2: "GND",
          pin3: "GND",
          pin4: "VAC",
          pin5: "VAC",
          pin6: ["MNT_1_GND", "MNT_1", "GND"],
          pin7: ["MNT_2_GND", "MNT_2", "GND"],
        }}
        schPinArrangement={{
          rightSide: {
            pins: ["pin7", "pin6", "pin5", "pin4", "pin3", "pin2", "pin1"],
            direction: "bottom-to-top",
          },
        }}
        schPinStyle={{
          pin7: { bottomMargin: 6e-5 },
          pin6: { bottomMargin: 0.60041 },
          pin5: { bottomMargin: 1.00065 },
          pin4: { bottomMargin: 0.60041 },
          pin3: { bottomMargin: 0.60041 },
          pin2: { bottomMargin: 0.60041 },
          pin1: { bottomMargin: 0.60041, topMargin: 0 },
        }}
        schWidth={2.40007}
        schHeight={6.80358}
        pinAttributes={{
          pin1: { isPassive: true },
          pin2: { isPassive: true },
          pin3: { isPassive: true },
          pin4: { isPassive: true },
          pin5: { isPassive: true },
          pin6: { isPassive: true },
          pin7: { isPassive: true },
        }}
        manufacturerPartNumber="209159005101916"
      />
      <connector
        name="J6"
        schX={-5.03306}
        schY={-3.99588}
        pinLabels={{
          pin1: "GND",
          pin2: "GND",
          pin3: "I2Cc_SCL",
          pin4: "A_GPIO0",
          pin5: "I2Cc_SDA",
          pin6: "A_GPIO1",
          pin7: "I2Cc_IRQ",
          pin8: "A_GPIO2",
          pin9: "751_CC2",
          pin10: "A_GPIO3",
          pin11: "751_CC1",
          pin12: "A_GPIO4",
          pin13: "GND",
          pin14: "A_GPIO5",
          pin15: "I2Ct_SCL",
          pin17: "I2Ct_SDA",
          pin19: "I2Ct_IRQ",
          pin21: "GND",
          pin23: "VBUS_DIV2",
          pin25: "GND",
          pin27: "P3V3",
          pin29: "GND",
          pin16: "A_GPIO6",
          pin18: "A_GPIO7",
          pin20: "A_GPIO11",
          pin22: "NC",
          pin24: "PPHV_DIV2",
          pin26: "NC",
          pin28: "PP5V",
          pin30: "GND",
        }}
        schPinArrangement={{
          leftSide: {
            pins: [
              "pin1",
              "pin3",
              "pin5",
              "pin7",
              "pin9",
              "pin11",
              "pin13",
              "pin15",
              "pin17",
              "pin19",
              "pin21",
              "pin23",
              "pin25",
              "pin27",
              "pin29",
            ],
            direction: "top-to-bottom",
          },
          rightSide: {
            pins: [
              "pin30",
              "pin28",
              "pin26",
              "pin24",
              "pin22",
              "pin20",
              "pin18",
              "pin16",
              "pin14",
              "pin12",
              "pin10",
              "pin8",
              "pin6",
              "pin4",
              "pin2",
            ],
            direction: "bottom-to-top",
          },
        }}
        schPinStyle={{
          pin1: { topMargin: 1e-5 },
          pin3: { topMargin: 0.20017 },
          pin5: { topMargin: 0.20024 },
          pin7: { topMargin: 0.20023 },
          pin9: { topMargin: 0.20017 },
          pin11: { topMargin: 0.20024 },
          pin13: { topMargin: 0.20017 },
          pin15: { topMargin: 0.20024 },
          pin17: { topMargin: 0.20024 },
          pin19: { topMargin: 0.20017 },
          pin21: { topMargin: 0.20024 },
          pin23: { topMargin: 0.20017 },
          pin25: { topMargin: 0.20024 },
          pin27: { topMargin: 0.20023 },
          pin29: { topMargin: 0.20018, bottomMargin: 0 },
          pin30: { bottomMargin: 0 },
          pin28: { bottomMargin: 0.20018 },
          pin26: { bottomMargin: 0.20023 },
          pin24: { bottomMargin: 0.20024 },
          pin22: { bottomMargin: 0.20017 },
          pin20: { bottomMargin: 0.20024 },
          pin18: { bottomMargin: 0.20017 },
          pin16: { bottomMargin: 0.20024 },
          pin14: { bottomMargin: 0.20024 },
          pin12: { bottomMargin: 0.20017 },
          pin10: { bottomMargin: 0.20024 },
          pin8: { bottomMargin: 0.20017 },
          pin6: { bottomMargin: 0.20023 },
          pin4: { bottomMargin: 0.20024 },
          pin2: { bottomMargin: 0.20017, topMargin: 1e-5 },
        }}
        schWidth={2.51}
        schHeight={6.4034}
        pinAttributes={{
          pin1: { isPassive: true },
          pin2: { isPassive: true },
          pin3: { isPassive: true },
          pin4: { isPassive: true },
          pin5: { isPassive: true },
          pin6: { isPassive: true },
          pin7: { isPassive: true },
          pin8: { isPassive: true },
          pin9: { isPassive: true },
          pin10: { isPassive: true },
          pin11: { isPassive: true },
          pin12: { isPassive: true },
          pin13: { isPassive: true },
          pin14: { isPassive: true },
          pin15: { isPassive: true },
          pin17: { isPassive: true },
          pin19: { isPassive: true },
          pin21: { isPassive: true },
          pin23: { isPassive: true },
          pin25: { isPassive: true },
          pin27: { isPassive: true },
          pin29: { isPassive: true },
          pin16: { isPassive: true },
          pin18: { isPassive: true },
          pin20: { isPassive: true },
          pin22: { isPassive: true },
          pin24: { isPassive: true },
          pin26: { isPassive: true },
          pin28: { isPassive: true },
          pin30: { isPassive: true },
        }}
        manufacturerPartNumber="TSW-115-08L-D"
      />
      <mosfet
        name="Q2"
        schX={13.42844}
        schY={-8.99849}
        mosfetMode="enhancement"
        channelType="n"
        symbolGateSide="left"
        symbolSourceSide="bottom"
        symbolDrainSide="top"
        manufacturerPartNumber="CSD15380F3"
      />
      <mosfet
        name="Q3"
        schX={21.42793}
        schY={-8.99849}
        mosfetMode="enhancement"
        channelType="n"
        symbolGateSide="left"
        symbolSourceSide="bottom"
        symbolDrainSide="top"
        manufacturerPartNumber="CSD15380F3"
      />
      <mosfet
        name="Q4"
        schX={29.4265}
        schY={-8.99849}
        mosfetMode="enhancement"
        channelType="n"
        symbolGateSide="left"
        symbolSourceSide="bottom"
        symbolDrainSide="top"
        manufacturerPartNumber="CSD15380F3"
      />
      <mosfet
        name="Q5"
        schX={37.4268}
        schY={-8.99849}
        mosfetMode="enhancement"
        channelType="n"
        symbolGateSide="left"
        symbolSourceSide="bottom"
        symbolDrainSide="top"
        manufacturerPartNumber="CSD15380F3"
      />
      <resistor
        name="R36"
        schX={11.76754}
        schY={-9.99905}
        resistance="10.0kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="RC0201FR-0710KL"
      />
      <resistor
        name="R37"
        schX={19.76952}
        schY={-9.99905}
        resistance="10.0kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="RC0201FR-0710KL"
      />
      <resistor
        name="R38"
        schX={27.76646}
        schY={-9.99905}
        resistance="10.0kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="RC0201FR-0710KL"
      />
      <resistor
        name="R39"
        schX={35.76676}
        schY={-9.99905}
        resistance="10.0kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="RC0201FR-0710KL"
      />
      {/* Keep the LED, series resistor and native MOSFET drain on one straight column. */}
      <resistor
        name="R28"
        schX={13.72844}
        schY={-5.99694}
        resistance="10.0kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="RC0402FR-0710KL"
      />
      {/* Keep the LED, series resistor and native MOSFET drain on one straight column. */}
      <resistor
        name="R29"
        schX={21.72793}
        schY={-5.99694}
        resistance="10.0kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="RC0402FR-0710KL"
      />
      {/* Keep the LED, series resistor and native MOSFET drain on one straight column. */}
      <resistor
        name="R30"
        schX={29.7265}
        schY={-5.99694}
        resistance="10.0kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="RC0402FR-0710KL"
      />
      {/* Keep the LED, series resistor and native MOSFET drain on one straight column. */}
      <resistor
        name="R31"
        schX={37.7268}
        schY={-5.99694}
        resistance="10.0kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="RC0402FR-0710KL"
      />
      {/* Keep the LED, series resistor and native MOSFET drain on one straight column. */}
      <led
        name="D5"
        schX={13.72844}
        schY={-3.19544}
        color="white"
        schRotation={270}
        manufacturerPartNumber="LW QH8G-Q2S2-3K5L-1"
      />
      {/* Keep the LED, series resistor and native MOSFET drain on one straight column. */}
      <led
        name="D6"
        schX={21.72793}
        schY={-3.19544}
        color="white"
        schRotation={270}
        manufacturerPartNumber="LW QH8G-Q2S2-3K5L-1"
      />
      {/* Keep the LED, series resistor and native MOSFET drain on one straight column. */}
      <led
        name="D7"
        schX={29.7265}
        schY={-3.19544}
        color="white"
        schRotation={270}
        manufacturerPartNumber="LW QH8G-Q2S2-3K5L-1"
      />
      {/* Keep the LED, series resistor and native MOSFET drain on one straight column. */}
      <led
        name="D8"
        schX={37.7268}
        schY={-3.19544}
        color="white"
        schRotation={270}
        manufacturerPartNumber="LW QH8G-Q2S2-3K5L-1"
      />
      <connector
        name="J7"
        schX={-31.83237}
        schY={-9.39791}
        pinLabels={{
          pin1: "PP5V",
          pin2: "GND",
          pin3: "GND",
          pin4: "I2Cc_SCL",
          pin5: "NC",
          pin6: "I2Cc_SDA",
          pin7: "LDO_3V3",
          pin8: "NC",
        }}
        schPinArrangement={{
          leftSide: {
            pins: ["pin2", "pin4", "pin6", "pin8"],
            direction: "top-to-bottom",
          },
          rightSide: {
            pins: ["pin7", "pin5", "pin3", "pin1"],
            direction: "bottom-to-top",
          },
        }}
        schPinStyle={{
          pin2: { topMargin: 0 },
          pin4: { topMargin: 0.20024 },
          pin6: { topMargin: 0.20017 },
          pin8: { topMargin: 0.20024, bottomMargin: 7e-5 },
          pin7: { bottomMargin: 7e-5 },
          pin5: { bottomMargin: 0.20024 },
          pin3: { bottomMargin: 0.20017 },
          pin1: { bottomMargin: 0.20024, topMargin: 0 },
        }}
        schWidth={2.4001}
        schHeight={2.00106}
        pinAttributes={{
          pin1: { isPassive: true },
          pin2: { isPassive: true },
          pin3: { isPassive: true },
          pin4: { isPassive: true },
          pin5: { isPassive: true },
          pin6: { isPassive: true },
          pin7: { isPassive: true },
          pin8: { isPassive: true },
        }}
        manufacturerPartNumber="TSW-104-07G-D"
      />
      {/* Align the series gate resistor with the native MOSFET gate terminal. */}
      <resistor
        name="R35"
        schX={34.56671}
        schY={-9.09849}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={0}
        manufacturerPartNumber="CRCW02010000Z0ED"
      />
      {/* Align the series gate resistor with the native MOSFET gate terminal. */}
      <resistor
        name="R33"
        schX={18.56947}
        schY={-9.09849}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={0}
        manufacturerPartNumber="CRCW02010000Z0ED"
      />
      {/* Align the series gate resistor with the native MOSFET gate terminal. */}
      <resistor
        name="R32"
        schX={10.56752}
        schY={-9.09849}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={0}
        manufacturerPartNumber="CRCW02010000Z0ED"
      />
      {/* Align the series gate resistor with the native MOSFET gate terminal. */}
      <resistor
        name="R34"
        schX={26.56643}
        schY={-9.09849}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={0}
        manufacturerPartNumber="CRCW02010000Z0ED"
      />
      <resistor
        name="R22"
        schX={20.16951}
        schY={8.01045}
        resistance="5.10kohm"
        symbolName="resistor"
        schRotation={90}
        manufacturerPartNumber="RC0201FR-075K1L"
      />
      <chip
        name="L2"
        schX={-28.23264}
        schY={-0.39313}
        noSchematicRepresentation
        pinLabels={{ pin1: "1", pin2: "2" }}
        schRotation={0}
        pinAttributes={{ pin1: { isPassive: true }, pin2: { isPassive: true } }}
        manufacturerPartNumber="742792021"
      />
      <schematicsymbol
        name="L2_symbol"
        displayName="L2 22ohm"
        chipRef="chip.L2"
        symbolName="ferrite_bead"
        schX={-28.23264}
        schY={-0.39313}
        schRotation={0}
        connections={{ pin1: ".L2 > .pin1", pin2: ".L2 > .pin2" }}
      />
      <chip
        name="L4"
        schX={-28.23264}
        schY={-2.79442}
        noSchematicRepresentation
        pinLabels={{ pin1: "1", pin2: "2" }}
        schRotation={180}
        pinAttributes={{ pin1: { isPassive: true }, pin2: { isPassive: true } }}
        manufacturerPartNumber="742792021"
      />
      <schematicsymbol
        name="L4_symbol"
        displayName="L4 22ohm"
        chipRef="chip.L4"
        symbolName="ferrite_bead"
        schX={-28.23264}
        schY={-2.79442}
        schRotation={180}
        connections={{ pin1: ".L4 > .pin1", pin2: ".L4 > .pin2" }}
      />
      <chip
        name="L5"
        schX={-28.23264}
        schY={-3.99507}
        noSchematicRepresentation
        pinLabels={{ pin1: "1", pin2: "2" }}
        schRotation={0}
        pinAttributes={{ pin1: { isPassive: true }, pin2: { isPassive: true } }}
      />
      <schematicsymbol
        name="L5_symbol"
        displayName="L5 "
        chipRef="chip.L5"
        symbolName="ferrite_bead"
        schX={-28.23264}
        schY={-3.99507}
        schRotation={0}
        connections={{ pin1: ".L5 > .pin1", pin2: ".L5 > .pin2" }}
      />
      <chip
        name="L3"
        schX={-28.23264}
        schY={-1.59377}
        noSchematicRepresentation
        pinLabels={{ pin1: "1", pin2: "2" }}
        schRotation={0}
        pinAttributes={{ pin1: { isPassive: true }, pin2: { isPassive: true } }}
      />
      <schematicsymbol
        name="L3_symbol"
        displayName="L3 "
        chipRef="chip.L3"
        symbolName="ferrite_bead"
        schX={-28.23264}
        schY={-1.59377}
        schRotation={0}
        connections={{ pin1: ".L3 > .pin1", pin2: ".L3 > .pin2" }}
      />
      <resistor
        name="R24"
        schX={-11.83164}
        schY={-5.59674}
        resistance="100kohm"
        symbolName="resistor"
        schRotation={0}
        manufacturerPartNumber="RC0201FR-07100KL"
      />
      <resistor
        name="R26"
        schX={-10.23326}
        schY={-7.19756}
        resistance="100kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="RC0201FR-07100KL"
      />
      <resistor
        name="R27"
        schX={0.16711}
        schY={-7.19756}
        resistance="100kohm"
        symbolName="resistor"
        schRotation={90}
        manufacturerPartNumber="RC0201FR-07100KL"
      />
      <resistor
        name="R25"
        schX={1.36717}
        schY={-5.59674}
        resistance="100kohm"
        symbolName="resistor"
        schRotation={0}
        manufacturerPartNumber="RC0201FR-07100KL"
      />

      {/* Electrical connections transcribed from TI, including labeled nets. */}
      <trace from="J2.pin1" to="net.GND" />
      <trace from="J2.pin22" to="net.GND" />
      <trace from="J2.pin23" to="net.GND" />
      <trace from="J2.pin24" to="net.GND" />
      <trace from="J2.pin12" to="net.GND" />
      <trace from="J2.pin21" to="net.GND" />
      <trace from="J2.pin25" to="net.GND" />
      <trace from="J2.pin26" to="net.GND" />
      <trace from="J2.pin15" to={netSelector("730_VBUS")} />
      <trace from="J2.pin18" to={netSelector("730_VBUS")} />
      <trace from="J2.pin4" to={netSelector("730_VBUS")} />
      <trace from="J2.pin9" to={netSelector("730_VBUS")} />
      <trace from="J2.pin5" to={netSelector("730_CC1")} />
      <trace from="J2.pin17" to={netSelector("730_CC2")} />
      <trace from="J3.pin1" to="net.GND" />
      <trace from="J3.pin22" to="net.GND" />
      <trace from="J3.pin23" to="net.GND" />
      <trace from="J3.pin24" to="net.GND" />
      <trace from="J3.pin12" to="net.GND" />
      <trace from="J3.pin21" to="net.GND" />
      <trace from="J3.pin25" to="net.GND" />
      <trace from="J3.pin26" to="net.GND" />
      <trace from="J3.pin15" to={netSelector("751_VBUS")} />
      <trace from="J3.pin18" to={netSelector("751_VBUS")} />
      <trace from="J3.pin17" to={netSelector("751_C_CC2")} />
      <trace from="J3.pin16" to={netSelector("751_C_SBU2")} />
      <trace from="J4.pin15" to="net.TIVA_VBUS" />
      <trace from="J4.pin1" to="net.GND" />
      <trace from="J4.pin22" to="net.GND" />
      <trace from="J4.pin23" to="net.GND" />
      <trace from="J4.pin24" to="net.GND" />
      <trace from="R23.pin1" to="net.GND" />
      <trace from="J4.pin12" to="net.GND" />
      <trace from="J4.pin21" to="net.GND" />
      <trace from="J4.pin25" to="net.GND" />
      <trace from="J4.pin26" to="net.GND" />
      <trace from="R22.pin1" to="net.GND" />
      <trace from="J4.pin4" to="net.TIVA_VBUS" />
      <trace from="J4.pin9" to="net.TIVA_VBUS" />
      <trace from="J4.pin18" to="net.TIVA_VBUS" />
      <trace from="J4.pin5" to="R23.pin2" />
      <trace from="J6.pin2" to="net.GND" />
      <trace from="J6.pin30" to="net.GND" />
      <trace from="J6.pin4" to="net.A_GPIO0" />
      <trace from="J6.pin6" to="net.A_GPIO1" />
      <trace from="J6.pin8" to="net.A_GPIO2" />
      <trace from="J6.pin10" to="net.A_GPIO3" />
      <trace from="J6.pin20" to="net.A_GPIO11" />
      <trace from="J6.pin28" to="net.PP5V" />
      <trace from="J6.pin27" to="net.P3V3" />
      <trace from="J6.pin3" to="net.I2Cc_SCL" />
      <trace from="J6.pin5" to="net.I2Cc_SDA" />
      <trace from="J6.pin7" to="net.I2Cc_IRQ" />
      <trace from="J6.pin15" to="net.I2Ct_SCL" />
      <trace from="J6.pin17" to="net.I2Ct_SDA" />
      <trace from="J6.pin19" to="net.I2Ct_IRQ" />
      <trace from="J6.pin1" to="net.GND" />
      <trace from="J6.pin13" to="net.GND" />
      <trace from="J6.pin21" to="net.GND" />
      <trace from="J6.pin25" to="net.GND" />
      <trace from="J6.pin29" to="net.GND" />
      <trace from="J7.pin1" to="net.PP5V" />
      <trace from="J7.pin3" to="net.GND" />
      <trace from="J7.pin7" to="net.LDO_3V3" />
      <trace from="J7.pin6" to="net.I2Cc_SDA" />
      <trace from="J7.pin4" to="net.I2Cc_SCL" />
      <trace from="J5.pin2" to="net.GND" />
      <trace from="J5.pin3" to="net.GND" />
      <trace from="J5.pin6" to="net.GND" />
      <trace from="J5.pin7" to="net.GND" />
      <trace from="Q2.drain" to="R28.pin2" />
      <trace from="R28.pin1" to="D5.pin2" />
      <trace from="Q3.drain" to="R29.pin2" />
      <trace from="R29.pin1" to="D6.pin2" />
      <trace from="Q4.drain" to="R30.pin2" />
      <trace from="J7.pin2" to="net.GND" />
      <trace from="J3.pin9" to={netSelector("751_VBUS")} />
      <trace from="J3.pin8" to={netSelector("751_C_SBU1")} />
      <trace from="J3.pin5" to={netSelector("751_C_CC1")} />
      <trace from="J3.pin4" to={netSelector("751_VBUS")} />
      <trace from="R31.pin1" to="D8.pin2" />
      <trace from="Q5.drain" to="R31.pin2" />
      <trace from="R30.pin1" to="D7.pin2" />
      <trace from="Q2.source" to="net.GND" />
      <trace from="Q3.source" to="net.GND" />
      <trace from="Q4.source" to="net.GND" />
      <trace from="Q5.source" to="net.GND" />
      <trace from="R36.pin2" to="net.GND" />
      <trace from="R37.pin2" to="net.GND" />
      <trace from="R38.pin2" to="net.GND" />
      <trace from="R39.pin2" to="net.GND" />
      <trace from="J5.pin4" to="net.VAC" />
      <trace from="J5.pin5" to="net.VAC" />
      <trace from="L4.pin2" to="net.VAC" />
      <trace from="L5.pin1" to="net.VAC" />
      <trace from="J6.pin12" to="net.A_GPIO4" />
      <trace from="J6.pin14" to="net.A_GPIO5" />
      <trace from="J6.pin16" to="net.A_GPIO6" />
      <trace from="J6.pin18" to="net.A_GPIO7" />
      <trace from="Q5.gate" to="R39.pin1" />
      <trace from="Q5.gate" to="R35.pin2" />
      <trace from="D5.pin1" to="net.LDO_3V3" />
      <trace from="D6.pin1" to="net.LDO_3V3" />
      <trace from="D7.pin1" to="net.LDO_3V3" />
      <trace from="D8.pin1" to="net.LDO_3V3" />
      <trace from="Q3.gate" to="R37.pin1" />
      <trace from="Q3.gate" to="R33.pin2" />
      <trace from="Q2.gate" to="R36.pin1" />
      <trace from="Q2.gate" to="R32.pin2" />
      <trace from="J4.pin17" to="R22.pin2" />
      <trace from="Q4.gate" to="R38.pin1" />
      <trace from="Q4.gate" to="R34.pin2" />
      <trace from="J5.pin1" to="net.BAT" />
      <trace from="L2.pin1" to="net.BAT" />
      <trace from="L3.pin1" to="net.BAT" />
      <trace from="L2.pin2" to="net.VBAT" />
      <trace from="L3.pin2" to={netSelector("751_PPHV")} />
      <trace from="L4.pin1" to={netSelector("751_PPHV")} />
      <trace from="L5.pin2" to="net.VBAT" />
      <trace from="J6.pin9" to={netSelector("751_CC2")} />
      <trace from="J6.pin11" to={netSelector("751_CC1")} />
      <trace from="R25.pin2" to={netSelector("751_PPHV")} />
      <trace from="R24.pin1" to={netSelector("751_VBUS")} />
      <trace from="J6.pin23" to="R24.pin2" />
      <trace from="J6.pin23" to="R26.pin1" />
      <trace from="R27.pin1" to="net.GND" />
      <trace from="J6.pin24" to="R27.pin2" />
      <trace from="J6.pin24" to="R25.pin1" />
      <trace from="R26.pin2" to="net.GND" />
      <trace from="J4.pin28" to="net.TIVA_D_N" />
      <trace from="J4.pin27" to="net.TIVA_D_P" />
      <trace from="J4.pin7" to="net.TIVA_D_N" />
      <trace from="J4.pin6" to="net.TIVA_D_P" />
      <trace from="J3.pin28" to={netSelector("751_D_N")} />
      <trace from="J3.pin27" to={netSelector("751_D_P")} />
      <trace from="J3.pin7" to={netSelector("751_D_N")} />
      <trace from="J3.pin6" to={netSelector("751_D_P")} />
      <trace from="R35.pin1" to="net.A_GPIO1" />
      <trace from="R33.pin1" to="net.A_GPIO2" />
      <trace from="R32.pin1" to="net.A_GPIO3" />
      <trace from="R34.pin1" to="net.A_GPIO11" />

      {/* Preserve additional TI net aliases through electrical connections. */}

      {/* TI section outlines and configuration-table borders. */}
      <schematicbox
        schX={-30.23271}
        schY={9.0114}
        width={20.7999}
        height={10.00443}
      />
      <schematicbox
        schX={-8.63236}
        schY={9.01098}
        width={20.79912}
        height={10.00528}
      />
      <schematicbox
        schX={12.9676}
        schY={9.01098}
        width={20.79741}
        height={10.00528}
      />
      <schematicbox
        schX={24.36798}
        schY={-6.59726}
        width={33.99789}
        height={14.8078}
      />
      <schematicbox
        schX={-30.23229}
        schY={-6.39629}
        width={17.60066}
        height={15.20634}
      />
      <schematictext
        text={"TPS25751 Type C"}
        schX={-8.78642}
        schY={14.624}
        fontSize={1.15965}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"TIVA Type C"}
        schX={12.84841}
        schY={14.624}
        fontSize={1.15965}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"Power Input TPS25730 Type C"}
        schX={-29.80125}
        schY={14.624}
        fontSize={1.15965}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"Status Indication LEDs"}
        schX={21.96056}
        schY={1.41702}
        fontSize={1.15965}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"BQ/PD INTERFACE"}
        schX={-31.25449}
        schY={1.81725}
        fontSize={1.15965}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"751_C_CC1"}
        schX={32.78295}
        schY={11.17963}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"751_C_SBU2"}
        schX={32.88309}
        schY={12.38021}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"751_D_N"}
        schX={32.592}
        schY={11.5798}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"751_D_P"}
        schX={32.56545}
        schY={11.98004}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"TIVA_D_P"}
        schX={32.65198}
        schY={9.17857}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"TIVA_D_N"}
        schX={32.67853}
        schY={8.77833}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"751_C_SBU1"}
        schX={32.88309}
        schY={12.78045}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"TIVA_VBUS"}
        schX={28.72291}
        schY={9.80441}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"751_VBUS"}
        schX={28.63619}
        schY={13.40629}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"751_C_CC1"}
        schX={28.74611}
        schY={11.40523}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"730_CC2"}
        schX={32.58303}
        schY={6.77728}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"730_CC1"}
        schX={32.58303}
        schY={7.17752}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"730_CC2"}
        schX={28.51293}
        schY={7.00288}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"751_C_CC2"}
        schX={32.78298}
        schY={10.77939}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"TIVA_VBUS"}
        schX={32.77852}
        schY={9.57874}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"751_VBUS"}
        schX={32.69199}
        schY={13.18068}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"730_VBUS"}
        schX={32.69199}
        schY={7.57769}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"730_CC1"}
        schX={28.51279}
        schY={7.40311}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"730_VBUS"}
        schX={28.63629}
        schY={7.80335}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"751_C_CC2"}
        schX={28.74618}
        schY={11.00499}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"751_C_SBU2"}
        schX={28.85272}
        schY={12.60587}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"751_C_SBU1"}
        schX={28.85272}
        schY={13.00611}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"P3V3"}
        schX={28.19972}
        schY={5.40206}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"A_GPIO0"}
        schX={35.72641}
        schY={13.40629}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"A_GPIO1"}
        schX={35.72641}
        schY={13.00611}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"A_GPIO2"}
        schX={35.72641}
        schY={12.60587}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"A_GPIO3"}
        schX={35.72641}
        schY={12.20564}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"A_GPIO4"}
        schX={35.72641}
        schY={11.80546}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"A_GPIO5"}
        schX={35.72641}
        schY={11.40523}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"A_GPIO6"}
        schX={35.72641}
        schY={11.00499}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"A_GPIO7"}
        schX={35.72641}
        schY={10.60482}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"A_GPIO11"}
        schX={35.8065}
        schY={10.20458}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"I2Cc_SCL"}
        schX={35.79314}
        schY={9.004}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"I2Cc_SDA"}
        schX={35.81317}
        schY={8.60376}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"I2Ct_SCL"}
        schX={35.75303}
        schY={7.80335}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"I2Cc_IRQ"}
        schX={35.74643}
        schY={8.20352}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"I2Ct_SDA"}
        schX={35.77306}
        schY={7.40311}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"I2Ct_IRQ"}
        schX={35.70649}
        schY={7.00288}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"LDO_3V3"}
        schX={28.54626}
        schY={4.60165}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"751_PPHV"}
        schX={28.66616}
        schY={3.80124}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"VBAT"}
        schX={28.20635}
        schY={3.00083}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"P3V3"}
        schX={32.30885}
        schY={5.17646}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"LDO_3V3"}
        schX={32.61532}
        schY={4.37598}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"751_PPHV"}
        schX={32.71867}
        schY={3.57558}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"VBAT"}
        schX={32.31651}
        schY={2.77517}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"I2Cc_SCL"}
        schX={39.8611}
        schY={8.77833}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"I2Cc_SDA"}
        schX={39.87891}
        schY={8.3781}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"I2Cc_IRQ"}
        schX={39.81894}
        schY={7.97792}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"I2Ct_SCL"}
        schX={39.82783}
        schY={7.57769}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"I2Ct_SDA"}
        schX={39.84564}
        schY={7.17752}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"I2Ct_IRQ"}
        schX={39.78567}
        schY={6.77728}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"A_GPIO0"}
        schX={39.8101}
        schY={13.18068}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"A_GPIO1"}
        schX={39.8101}
        schY={12.78045}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"A_GPIO2"}
        schX={39.8101}
        schY={12.38021}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"A_GPIO3"}
        schX={39.8101}
        schY={11.98004}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"A_GPIO4"}
        schX={39.8101}
        schY={11.5798}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"A_GPIO5"}
        schX={39.8101}
        schY={11.17963}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"A_GPIO6"}
        schX={39.8101}
        schY={10.77939}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"A_GPIO7"}
        schX={39.8101}
        schY={10.37915}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"A_GPIO11"}
        schX={39.87746}
        schY={9.97898}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"LDO_1V5"}
        schX={32.61519}
        schY={4.77622}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"LDO_1V5"}
        schX={28.54607}
        schY={5.00189}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"PP5V"}
        schX={28.23953}
        schY={2.60059}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"PP5V"}
        schX={32.34537}
        schY={2.37493}
        fontSize={0.31988}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"751_D_P"}
        schX={28.4962}
        schY={12.20564}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"751_D_N"}
        schX={28.5194}
        schY={11.80546}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"TIVA_D_P"}
        schX={28.58273}
        schY={9.40417}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"TIVA_D_N"}
        schX={28.60596}
        schY={9.004}
        fontSize={0.35986}
        anchor="center"
        schRotation={0}
      />
    </schematicsheet>
  )
}
