// TI SLVUCP9B, figure 5-3, page 40.
// TI layout with documented native-symbol spacing/alignment adjustments.
import { netSelector } from "./net-selector"

export function PowerStage() {
  return (
    <schematicsheet
      name="power-stage"
      displayName="Power Stage"
      sheetIndex={3}
      sheetWidth={634.91}
      sheetHeight={182.8}
    >
      <capacitor
        name="C60"
        schX={13.47099}
        schY={2.56808}
        capacitance="1uF"
        schRotation={270}
        manufacturerPartNumber="C1005X6S1C105K050BC"
      />
      <capacitor
        name="C63"
        schX={22.66932}
        schY={2.16859}
        capacitance="1uF"
        schRotation={270}
        manufacturerPartNumber="C1005X6S1C105K050BC"
      />
      <chip
        name="U11"
        schX={17.86968}
        schY={2.36915}
        pinLabels={{
          pin1: "OUT",
          pin2: "GND",
          pin5: "PAD",
          pin3: "EN",
          pin4: "IN",
        }}
        schPinArrangement={{
          leftSide: { pins: ["pin4", "pin3"], direction: "top-to-bottom" },
          rightSide: {
            pins: ["pin2", "pin5", "pin1"],
            direction: "bottom-to-top",
          },
        }}
        schPinStyle={{
          pin4: { topMargin: 0 },
          pin3: { topMargin: 1.39795, bottomMargin: 0.79735 },
          pin2: { bottomMargin: 0 },
          pin5: { bottomMargin: 0.59891 },
          pin1: { bottomMargin: 1.39795, topMargin: 0.00156 },
        }}
        schWidth={4.7999}
        schHeight={3.99311}
        pinAttributes={{
          pin1: {
            providesPower: true,
            providesVoltage: "3.3V",
            shouldHaveDecouplingCapacitor: true,
          },
          pin2: { requiresGround: true },
          pin3: { isInput: true },
          pin4: { requiresPower: true, shouldHaveDecouplingCapacitor: true },
          pin5: { requiresGround: true },
        }}
        manufacturerPartNumber="TLV75533PDQNT"
      />
      <chip
        name="U10"
        schX={-8.52671}
        schY={-0.42635}
        pinLabels={{
          pin13: "AGND",
          pin14: "AGND",
          pin15: "AGND",
          pin9: "BIAS",
          pin6: "CBOOT",
          pin18: "EN",
          pin12: "FB",
          pin7: "NC",
          pin19: "NC",
          pin23: "NC",
          pin27: "NC",
          pin28: "NC",
          pin29: "NC",
          pin30: "NC",
          pin31: "PAD",
          pin26: "PGND",
          pin24: "PGND",
          pin25: "PGND",
          pin16: "PGOOD",
          pin20: "PVIN",
          pin21: "PVIN",
          pin22: "PVIN",
          pin10: "RT",
          pin11: "SS_TRK",
          pin5: "SW",
          pin1: "SW",
          pin2: "SW",
          pin3: "SW",
          pin4: "SW",
          pin17: "SYNC_MODE",
          pin8: "VCC",
        }}
        schPinArrangement={{
          leftSide: {
            pins: [
              "pin8",
              "pin20",
              "pin21",
              "pin22",
              "pin18",
              "pin16",
              "pin11",
              "pin10",
              "pin17",
              "pin7",
              "pin19",
              "pin23",
              "pin27",
              "pin28",
              "pin29",
              "pin30",
            ],
            direction: "top-to-bottom",
          },
          rightSide: {
            pins: [
              "pin31",
              "pin26",
              "pin25",
              "pin24",
              "pin15",
              "pin14",
              "pin13",
              "pin12",
              "pin9",
              "pin6",
              "pin5",
              "pin4",
              "pin3",
              "pin2",
              "pin1",
            ],
            direction: "bottom-to-top",
          },
        }}
        schPinStyle={{
          pin8: { topMargin: 0 },
          pin20: { topMargin: 0.59897 },
          pin21: { topMargin: 0.19949 },
          pin22: { topMargin: 0.19864 },
          pin18: { topMargin: 0.59898 },
          pin16: { topMargin: 0.59897 },
          pin11: { topMargin: 0.59806 },
          pin10: { topMargin: 0.59897 },
          pin17: { topMargin: 0.59813 },
          pin7: { topMargin: 0.59897 },
          pin19: { topMargin: 0.19949 },
          pin23: { topMargin: 0.19942 },
          pin27: { topMargin: 0.1987 },
          pin28: { topMargin: 0.19943 },
          pin29: { topMargin: 0.19948 },
          pin30: { topMargin: 0.19949, bottomMargin: 7e-5 },
          pin31: { bottomMargin: 0 },
          pin26: { bottomMargin: 0.59898 },
          pin25: { bottomMargin: 0.19948 },
          pin24: { bottomMargin: 0.19943 },
          pin15: { bottomMargin: 0.59812 },
          pin14: { bottomMargin: 0.19949 },
          pin13: { bottomMargin: 0.19949 },
          pin12: { bottomMargin: 0.59812 },
          pin9: { bottomMargin: 1.39788 },
          pin6: { bottomMargin: 0.59813 },
          pin5: { bottomMargin: 0.99846 },
          pin4: { bottomMargin: 0.19864 },
          pin3: { bottomMargin: 0.19949 },
          pin2: { bottomMargin: 0.19948 },
          pin1: { bottomMargin: 0.19949, topMargin: 0.39942 },
        }}
        schWidth={4.79983}
        schHeight={10.38137}
        pinAttributes={{
          pin1: { providesPower: true },
          pin2: { providesPower: true },
          pin3: { providesPower: true },
          pin4: { providesPower: true },
          pin5: { providesPower: true },
          pin6: { requiresPower: true },
          pin7: { doNotConnect: true },
          pin8: { providesPower: true, shouldHaveDecouplingCapacitor: true },
          pin9: { requiresPower: true },
          pin10: { isBidirectional: true },
          pin11: { isBidirectional: true },
          pin12: { isInput: true },
          pin13: { requiresGround: true },
          pin14: { requiresGround: true },
          pin15: { requiresGround: true },
          pin16: {
            isOutput: true,
            canUseOpenDrain: true,
            isUsingOpenDrain: true,
          },
          pin17: { isInput: true },
          pin18: { isInput: true },
          pin19: { isPassive: true },
          pin20: { requiresPower: true, shouldHaveDecouplingCapacitor: true },
          pin21: { requiresPower: true, shouldHaveDecouplingCapacitor: true },
          pin22: { requiresPower: true, shouldHaveDecouplingCapacitor: true },
          pin23: { doNotConnect: true },
          pin24: { requiresGround: true },
          pin25: { requiresGround: true },
          pin26: { requiresGround: true },
          pin27: { isPassive: true },
          pin28: { isPassive: true },
          pin29: { isPassive: true },
          pin30: { isPassive: true },
          pin31: { requiresGround: true },
        }}
        manufacturerPartNumber="LM76005RNPR"
      />
      <inductor
        name="L7"
        schX={-1.72777}
        schY={4.26588}
        inductance="4.7uH"
        schRotation={0}
        manufacturerPartNumber="XAL6060-472MEB"
      />
      <capacitor
        name="C64"
        schX={-4.32723}
        schY={1.17075}
        capacitance="0.47uF"
        schRotation={180}
        manufacturerPartNumber="GRM155R61A474KE15D"
      />
      <resistor
        name="R102"
        schX={-0.12778}
        schY={1.17072}
        resistance="100kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW0402100KFKED"
      />
      <resistor
        name="R104"
        schX={-0.12778}
        schY={-2.42372}
        resistance="23.7kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="ERJ-2RKF2372X"
      />
      <capacitor
        name="C65"
        schX={1.4727}
        schY={0.97098}
        capacitance="220uF"
        polarized
        schRotation={270}
        manufacturerPartNumber="TPSE227M016R0100"
      />
      <capacitor
        name="C66"
        schX={3.87167}
        schY={0.97098}
        capacitance="0.47uF"
        schRotation={270}
        manufacturerPartNumber="C1608X7R1H474K080AC"
      />
      <capacitor
        name="C62"
        schX={-17.32537}
        schY={2.16901}
        capacitance="0.47uF"
        schRotation={270}
        manufacturerPartNumber="C2012X7S2A474K125AB"
      />
      <capacitor
        name="C61"
        schX={-19.3251}
        schY={2.16901}
        capacitance="4.7uF"
        schRotation={270}
        manufacturerPartNumber="C3225X7S2A475K200AE"
      />
      <capacitor
        name="C59"
        schX={-21.32479}
        schY={3.36705}
        capacitance="2.2uF"
        schRotation={270}
        manufacturerPartNumber="C1005X6S1C225K050BC"
      />
      <resistor
        name="R103"
        schX={-15.32611}
        schY={0.3722}
        resistance="100kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW0402100KFKED"
      />
      <capacitor
        name="C67"
        schX={-14.12575}
        schY={0.57195}
        capacitance="15pF"
        schRotation={270}
        manufacturerPartNumber="GRM0335C2A150JA01D"
      />
      <resistor
        name="R101"
        schX={-15.32611}
        schY={2.76824}
        resistance="523kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW0402523KFKED"
      />

      {/* Electrical connections transcribed from TI, including labeled nets. */}
      <trace from="C63.pin1" to="net.P3V3" />
      <trace from="U11.pin1" to="net.P3V3" />
      <trace from="U11.pin2" to="net.GND" />
      <trace from="U11.pin5" to="net.GND" />
      <trace from="U10.pin8" to="C59.pin1" />
      <trace from="U10.pin7" to="net.GND" />
      <trace from="U10.pin19" to="net.GND" />
      <trace from="U10.pin23" to="net.GND" />
      <trace from="U10.pin27" to="net.GND" />
      <trace from="U10.pin28" to="net.GND" />
      <trace from="U10.pin29" to="net.GND" />
      <trace from="U10.pin30" to="net.GND" />
      <trace from="U10.pin17" to="net.GND" />
      <trace from="U10.pin13" to="net.GND" />
      <trace from="U10.pin14" to="net.GND" />
      <trace from="U10.pin15" to="net.GND" />
      <trace from="U10.pin9" to="net.GND" />
      <trace from="U10.pin31" to="net.GND" />
      <trace from="U10.pin26" to="net.GND" />
      <trace from="U10.pin24" to="net.GND" />
      <trace from="U10.pin25" to="net.GND" />
      <trace from="U10.pin5" to="U10.pin1" />
      <trace from="U10.pin5" to="U10.pin2" />
      <trace from="U10.pin5" to="U10.pin3" />
      <trace from="U10.pin5" to="U10.pin4" />
      <trace from="U10.pin5" to="L7.pin1" />
      <trace from="U10.pin5" to="C64.pin1" />
      <trace from="U10.pin6" to="C64.pin2" />
      <trace from="U10.pin12" to="R102.pin2" />
      <trace from="U10.pin12" to="R104.pin1" />
      <trace from="C60.pin1" to="net.PP5V" />
      <trace from="U11.pin3" to="net.PP5V" />
      <trace from="U11.pin4" to="net.PP5V" />
      <trace from="L7.pin2" to="net.PP5V" />
      <trace from="R102.pin1" to="net.PP5V" />
      <trace from="C65.pin1" to="net.PP5V" />
      <trace from="C66.pin1" to="net.PP5V" />
      <trace from="U10.pin20" to="net.VSYS" />
      <trace from="U10.pin21" to="net.VSYS" />
      <trace from="U10.pin22" to="net.VSYS" />
      <trace from="C62.pin1" to="net.VSYS" />
      <trace from="C61.pin1" to="net.VSYS" />
      <trace from="R101.pin1" to="net.VSYS" />
      <trace from="U10.pin16" to="net.GND" />
      <trace from="R103.pin2" to="net.GND" />
      <trace from="C67.pin2" to="net.GND" />
      <trace from="U10.pin18" to="R103.pin1" />
      <trace from="U10.pin18" to="C67.pin1" />
      <trace from="U10.pin18" to="R101.pin2" />
      <trace from="C60.pin2" to="net.GND" />
      <trace from="C63.pin2" to="net.GND" />
      <trace from="R104.pin2" to="net.GND" />
      <trace from="C65.pin2" to="net.GND" />
      <trace from="C66.pin2" to="net.GND" />
      <trace from="C62.pin2" to="net.GND" />
      <trace from="C61.pin2" to="net.GND" />
      <trace from="C59.pin2" to="net.GND" />

      {/* Preserve additional TI net aliases through electrical connections. */}

      {/* TI section outlines and configuration-table borders. */}
      <schematicbox
        schX={-23.72422}
        schY={-4.41945}
        width={7.99883}
        height={3.99311}
      />
      <schematictext
        text={"Enable Voltage Range"}
        schX={-23.41323}
        schY={-1.81542}
        fontSize={1.15993}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"Please note:"}
        schX={-26.33186}
        schY={-3.03138}
        fontSize={0.36}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"In order for device powerstage to work, a "}
        schX={-24.05038}
        schY={-3.43087}
        fontSize={0.36}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"minimum of 7.5V and maximum of 42V is "}
        schX={-24.03202}
        schY={-3.83029}
        fontSize={0.36}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"needed to enable buck converter (LM76005). "}
        schX={-23.71198}
        schY={-4.22978}
        fontSize={0.36}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"This is scaled to support 2S-10S battery."}
        schX={-24.14362}
        schY={-4.62927}
        fontSize={0.36}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"If you wish to allow for lower input voltage, "}
        schX={-23.94526}
        schY={-5.42824}
        fontSize={0.36}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"you will need to change enable pin UVLO "}
        schX={-23.98287}
        schY={-5.82773}
        fontSize={0.36}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"condition with R115 and R116."}
        schX={-24.923}
        schY={-6.22715}
        fontSize={0.36}
        anchor="center"
        schRotation={0}
      />
    </schematicsheet>
  )
}
