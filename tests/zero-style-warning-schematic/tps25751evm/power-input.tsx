// TI SLVUCP9B, figure 5-1, page 39.
// TI layout with documented native-symbol spacing/alignment adjustments.
import { netSelector } from "./net-selector"

export function PowerInput() {
  return (
    <schematicsheet
      name="power-input"
      displayName="TPS25730 Power Input"
      sheetIndex={1}
      sheetWidth={609.11}
      sheetHeight={376.01}
    >
      <capacitor
        name="C14"
        schX={-26.36151}
        schY={-1.20836}
        capacitance="330pF"
        schRotation={270}
        manufacturerPartNumber="CGA1A2X7R1H331K030BA"
      />
      <capacitor
        name="C15"
        schX={-24.76167}
        schY={-1.20836}
        capacitance="330pF"
        schRotation={270}
        manufacturerPartNumber="CGA1A2X7R1H331K030BA"
      />
      <capacitor
        name="C1"
        schX={-6.36477}
        schY={6.39538}
        capacitance="0.1uF"
        schRotation={270}
        manufacturerPartNumber="GMK105BJ104KV-F"
      />
      <capacitor
        name="C8"
        schX={-2.36523}
        schY={-0.40789}
        capacitance="0.1uF"
        schRotation={270}
        manufacturerPartNumber="GMK105BJ104KV-F"
      />
      <capacitor
        name="C9"
        schX={-0.7646}
        schY={-0.40874}
        capacitance="10uF"
        schRotation={270}
        manufacturerPartNumber="GRM188R6YA106MA73D"
      />
      <connector
        name="J1"
        schX={7.23443}
        schY={-8.61367}
        pinLabels={{
          pin1: "730_PPHV",
          pin2: "730_PPHV",
          pin3: "VSYS",
          pin4: "VSYS",
          pin5: "VBAT",
          pin6: "VBAT",
        }}
        schPinArrangement={{
          topSide: {
            pins: ["pin6", "pin4", "pin2"],
            direction: "right-to-left",
          },
          bottomSide: {
            pins: ["pin1", "pin3", "pin5"],
            direction: "left-to-right",
          },
        }}
        schPinStyle={{
          pin6: { rightMargin: 0 },
          pin4: { rightMargin: 0.1999 },
          pin2: { rightMargin: 0.19996, leftMargin: 0 },
          pin1: { leftMargin: 0 },
          pin3: { leftMargin: 0.19996 },
          pin5: { leftMargin: 0.1999, rightMargin: 0 },
        }}
        schWidth={1.59978}
        schHeight={2.40188}
        pinAttributes={{
          pin1: { isPassive: true },
          pin2: { isPassive: true },
          pin3: { isPassive: true },
          pin4: { isPassive: true },
          pin5: { isPassive: true },
          pin6: { isPassive: true },
        }}
        manufacturerPartNumber="PEC03DAAN"
      />
      <capacitor
        name="C3"
        schX={13.63197}
        schY={1.19224}
        capacitance="0.01uF"
        schRotation={270}
        manufacturerPartNumber="C0402C103J5RACTU"
      />
      <capacitor
        name="C4"
        schX={15.63178}
        schY={1.19224}
        capacitance="0.01uF"
        schRotation={270}
        manufacturerPartNumber="C0402C103J5RACTU"
      />
      <capacitor
        name="C5"
        schX={17.63152}
        schY={1.19224}
        capacitance="0.01uF"
        schRotation={270}
        manufacturerPartNumber="C0402C103J5RACTU"
      />
      <capacitor
        name="C6"
        schX={19.63126}
        schY={1.19224}
        capacitance="0.01uF"
        schRotation={270}
        manufacturerPartNumber="C0402C103J5RACTU"
      />
      <chip
        name="L1"
        schX={12.03219}
        schY={3.79381}
        noSchematicRepresentation
        pinLabels={{ pin1: "1", pin2: "2" }}
        schRotation={180}
        pinAttributes={{ pin1: { isPassive: true }, pin2: { isPassive: true } }}
        manufacturerPartNumber="742792021"
      />
      <schematicsymbol
        name="L1_symbol"
        displayName="L1 22ohm"
        chipRef="chip.L1"
        symbolName="ferrite_bead"
        schX={12.03219}
        schY={3.79381}
        schRotation={180}
        connections={{ pin1: ".L1 > .pin1", pin2: ".L1 > .pin2" }}
      />
      <chip
        name="U2"
        schX={24.43069}
        schY={0.99211}
        pinLabels={{
          pin4: "IN",
          pin5: "IN",
          pin1: "GND",
          pin2: "GND",
          pin6: "IN",
          pin3: "GND",
          pin7: "PAD",
        }}
        schPinArrangement={{
          topSide: {
            pins: ["pin4", "pin5", "pin6"],
            direction: "right-to-left",
          },
          bottomSide: {
            pins: ["pin7", "pin3", "pin2", "pin1"],
            direction: "left-to-right",
          },
        }}
        schPinStyle={{
          pin4: { rightMargin: 0 },
          pin5: { rightMargin: 0.19996 },
          pin6: { rightMargin: 0.19996, leftMargin: 0 },
          pin7: { leftMargin: 0 },
          pin3: { leftMargin: 0.19996 },
          pin2: { leftMargin: 0.19996 },
          pin1: { leftMargin: 0.19996, rightMargin: 0.39996 },
        }}
        schWidth={2.39977}
        schHeight={4.80339}
        pinAttributes={{
          pin1: { requiresGround: true },
          pin2: { requiresGround: true },
          pin3: { requiresGround: true },
          pin4: { isPassive: true },
          pin5: { isPassive: true },
          pin6: { isPassive: true },
          pin7: { requiresGround: true },
        }}
        manufacturerPartNumber="TVS2200DRVR"
      />
      {/* Align the native LED terminals with its series resistor. */}
      <led
        name="D4"
        schX={12.43215}
        schY={-11.81558}
        color="blue"
        pinLabels={{ pin1: ["cathode", "neg"], pin2: ["anode", "pos"] }}
        schRotation={270}
        manufacturerPartNumber="150060BS75000"
      />
      <resistor
        name="R20"
        schX={12.43215}
        schY={-13.8168}
        resistance="10.0kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW040210K0FKED"
      />
      <capacitor
        name="C7"
        schX={21.631}
        schY={1.19224}
        capacitance="1uF"
        schRotation={270}
        manufacturerPartNumber="GRM155R6YA105KE11D"
      />
      {/* Separate the loose shunts so downward pins cannot cross the next shunt reference and part number. */}
      <jumper
        name="SH-J1"
        schX={5.03471}
        schY={-7.61341}
        pinCount={2}
        pinLabels={{ pin1: "1", pin2: "2" }}
        schPinArrangement={{
          bottomSide: { pins: ["pin1", "pin2"], direction: "left-to-right" },
        }}
        schPinStyle={{
          pin1: { leftMargin: 0 },
          pin2: { leftMargin: 0.19996, rightMargin: 6e-5 },
        }}
        schWidth={1.19982}
        schHeight={0.4005}
        pinAttributes={{ pin1: { isPassive: true }, pin2: { isPassive: true } }}
        manufacturerPartNumber="SNT-100-BK-G"
      />
      {/* Separate the loose shunts so downward pins cannot cross the next shunt reference and part number. */}
      <jumper
        name="SH-J2"
        schX={5.03471}
        schY={-10.01417}
        pinCount={2}
        pinLabels={{ pin1: "1", pin2: "2" }}
        schPinArrangement={{
          bottomSide: { pins: ["pin1", "pin2"], direction: "left-to-right" },
        }}
        schPinStyle={{
          pin1: { leftMargin: 0 },
          pin2: { leftMargin: 0.19996, rightMargin: 6e-5 },
        }}
        schWidth={1.19982}
        schHeight={0.40051}
        pinAttributes={{ pin1: { isPassive: true }, pin2: { isPassive: true } }}
        manufacturerPartNumber="SNT-100-BK-G"
      />
      <testpoint
        name="TP1"
        schX={15.2718}
        schY={14.60034}
        schRotation={180}
        manufacturerPartNumber="5015"
      />
      <testpoint
        name="TP2"
        schX={15.2718}
        schY={13.79983}
        schRotation={180}
        manufacturerPartNumber="5015"
      />
      <testpoint
        name="TP3"
        schX={15.2718}
        schY={12.99936}
        schRotation={180}
        manufacturerPartNumber="5015"
      />
      {/* Align the native LED terminals with its series resistor. */}
      <led
        name="D1"
        schX={10.83231}
        schY={2.59308}
        color="blue"
        pinLabels={{ pin1: ["cathode", "neg"], pin2: ["anode", "pos"] }}
        schRotation={270}
        manufacturerPartNumber="150060BS75000"
      />
      <resistor
        name="R11"
        schX={10.83231}
        schY={0.59189}
        resistance="10.0kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW040210K0FKED"
      />
      <resistor
        name="R12"
        schX={12.43215}
        schY={-7.41294}
        resistance="10.0kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW040210K0FKED"
      />
      {/* Align the native LED terminals with its series resistor. */}
      <led
        name="D2"
        schX={12.43215}
        schY={-5.41175}
        color="blue"
        pinLabels={{ pin1: ["cathode", "neg"], pin2: ["anode", "pos"] }}
        schRotation={270}
        manufacturerPartNumber="150060BS75000"
      />
      <capacitor
        name="C10"
        schX={0.83518}
        schY={-0.40874}
        capacitance="10uF"
        schRotation={270}
        manufacturerPartNumber="GRM188R6YA106MA73D"
      />
      <capacitor
        name="C11"
        schX={2.43503}
        schY={-0.40874}
        capacitance="10uF"
        schRotation={270}
        manufacturerPartNumber="GRM188R6YA106MA73D"
      />
      <capacitor
        name="C12"
        schX={4.03481}
        schY={-0.40874}
        capacitance="10uF"
        schRotation={270}
        manufacturerPartNumber="GRM188R6YA106MA73D"
      />
      <capacitor
        name="C13"
        schX={5.63465}
        schY={-0.40874}
        capacitance="10uF"
        schRotation={270}
        manufacturerPartNumber="GRM188R6YA106MA73D"
      />
      <resistor
        name="R6"
        schX={-20.36223}
        schY={11.79861}
        resistance="200kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW0201200KFKED"
      />
      <resistor
        name="R1"
        schX={-24.36174}
        schY={15.00056}
        resistance="200kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW0201200KFKED"
      />
      <capacitor
        name="C2"
        schX={8.03435}
        schY={1.59249}
        capacitance="1uF"
        schRotation={270}
        manufacturerPartNumber="GRM155R6YA105KE11D"
      />
      <resistor
        name="R16"
        schX={-5.56485}
        schY={-8.61285}
        resistance="2.20kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW02012K20FKED"
      />
      <resistor
        name="R15"
        schX={-7.16466}
        schY={-8.61285}
        resistance="2.20kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW02012K20FKED"
      />
      <resistor
        name="R5"
        schX={-24.36174}
        schY={11.79861}
        resistance="51.0kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="RC0201FR-0751KL"
      />
      <resistor
        name="R7"
        schX={-16.36272}
        schY={11.79861}
        resistance="51.0kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="RC0201FR-0751KL"
      />
      <resistor
        name="R8"
        schX={-12.3632}
        schY={11.79861}
        resistance="51.0kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="RC0201FR-0751KL"
      />
      <resistor
        name="R3"
        schX={-16.36272}
        schY={15.00056}
        resistance="200kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW0201200KFKED"
      />
      <resistor
        name="R4"
        schX={-12.3632}
        schY={15.00056}
        resistance="200kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW0201200KFKED"
      />
      <mosfet
        name="Q1"
        schX={-23.62183}
        schY={-12.81621}
        mosfetMode="enhancement"
        channelType="n"
        symbolGateSide="right"
        symbolSourceSide="bottom"
        symbolDrainSide="top"
        manufacturerPartNumber="CSD15380F3"
      />
      {/* Keep the LED, series resistor and native MOSFET drain on one straight column. */}
      <led
        name="D3"
        schX={-23.92183}
        schY={-8.2126}
        color="red"
        pinLabels={{ pin1: ["cathode", "neg"], pin2: ["anode", "pos"] }}
        schRotation={270}
        manufacturerPartNumber="150060RS75000"
      />
      {/* Keep the LED, series resistor and native MOSFET drain on one straight column. */}
      <resistor
        name="R19"
        schX={-23.92183}
        schY={-10.61489}
        resistance="10.0kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW040210K0FKED"
      />
      <chip
        name="U1"
        schX={-14.96331}
        schY={-1.40894}
        pinLabels={{
          pin1: "LDO_3V3",
          pin38: "VIN_3V3",
          pin2: "ADCIN1",
          pin3: "ADCIN2",
          pin5: "ADCIN3",
          pin7: "ADCIN4",
          pin9: "I2Ct_SCL",
          pin8: "I2Ct_SDA",
          pin37: "PLUG_EVENT",
          pin13: "PLUG_FLIP",
          pin15: "DRAIN",
          pin30: "DRAIN",
          pin18: "FAULT_IN",
          pin36: "Reserved",
          pin32: "VBUS",
          pin23: "VBUS_IN",
          pin26: "Reserved",
          pin27: "Reserved",
          pin6: "CAP_MIS",
          pin10: "DBG_ACC",
          pin4: "LDO_1V5",
          pin20: "PPHV",
          pin19: "SINK_EN",
          pin40: "DRAIN_PAD",
          pin28: "CC1",
          pin29: "CC2",
          pin11: "GND",
          pin12: "GND",
          pin14: "GND",
          pin16: "GND",
          pin17: "GND",
          pin31: "GND",
          pin34: "GND",
          pin39: "GND_PAD",
          pin21: "PPHV",
          pin22: "PPHV",
          pin33: "VBUS",
          pin35: "GND",
          pin24: "VBUS_IN",
          pin25: "VBUS_IN",
        }}
        schPinArrangement={{
          leftSide: {
            pins: [
              "pin10",
              "pin19",
              "pin2",
              "pin3",
              "pin5",
              "pin7",
              "pin28",
              "pin29",
              "pin6",
              "pin15",
              "pin30",
              "pin40",
              "pin11",
              "pin12",
              "pin14",
              "pin16",
              "pin17",
              "pin31",
              "pin34",
              "pin35",
              "pin39",
            ],
            direction: "top-to-bottom",
          },
          rightSide: {
            pins: [
              "pin27",
              "pin26",
              "pin8",
              "pin9",
              "pin36",
              "pin18",
              "pin13",
              "pin37",
              "pin4",
              "pin1",
              "pin22",
              "pin21",
              "pin20",
              "pin25",
              "pin24",
              "pin23",
              "pin33",
              "pin32",
              "pin38",
            ],
            direction: "bottom-to-top",
          },
        }}
        schPinStyle={{
          pin10: { topMargin: 0.40019 },
          pin19: { topMargin: 0.59965 },
          pin2: { topMargin: 1.00076 },
          pin3: { topMargin: 0.20025 },
          pin5: { topMargin: 0.20019 },
          pin7: { topMargin: 0.20025 },
          pin28: { topMargin: 1.00075 },
          pin29: { topMargin: 0.20025 },
          pin6: { topMargin: 1.00069 },
          pin15: { topMargin: 1.00076 },
          pin30: { topMargin: 0.20025 },
          pin40: { topMargin: 0.20018 },
          pin11: { topMargin: 1.00076 },
          pin12: { topMargin: 0.20025 },
          pin14: { topMargin: 0.20025 },
          pin16: { topMargin: 0.20019 },
          pin17: { topMargin: 0.20025 },
          pin31: { topMargin: 0.20025 },
          pin34: { topMargin: 0.20025 },
          pin35: { topMargin: 0.20025 },
          pin39: { topMargin: 0.20026, bottomMargin: 0 },
          pin27: { bottomMargin: 0 },
          pin26: { bottomMargin: 0.20026 },
          pin8: { bottomMargin: 1.401 },
          pin9: { bottomMargin: 0.20019 },
          pin36: { bottomMargin: 0.6005 },
          pin18: { bottomMargin: 0.6005 },
          pin13: { bottomMargin: 0.60044 },
          pin37: { bottomMargin: 0.20025 },
          pin4: { bottomMargin: 1.40101 },
          pin1: { bottomMargin: 0.20025 },
          pin22: { bottomMargin: 0.60044 },
          pin21: { bottomMargin: 0.20025 },
          pin20: { bottomMargin: 0.20025 },
          pin25: { bottomMargin: 0.6005 },
          pin24: { bottomMargin: 0.20019 },
          pin23: { bottomMargin: 0.20025 },
          pin33: { bottomMargin: 0.60051 },
          pin32: { bottomMargin: 0.20025 },
          pin38: { bottomMargin: 0.59965, topMargin: 0.40019 },
        }}
        schWidth={6.79821}
        schHeight={13.60738}
        pinAttributes={{
          pin1: {
            providesPower: true,
            providesVoltage: "3.3V",
            shouldHaveDecouplingCapacitor: true,
          },
          pin2: { isInput: true },
          pin3: { isInput: true },
          pin4: {
            providesPower: true,
            providesVoltage: "1.5V",
            shouldHaveDecouplingCapacitor: true,
          },
          pin5: { isInput: true },
          pin6: {
            isOutput: true,
            canUseOpenDrain: true,
            isUsingOpenDrain: true,
          },
          pin7: { isInput: true },
          pin8: {
            isBidirectional: true,
            canUseOpenDrain: true,
            isUsingOpenDrain: true,
            capabilities: ["i2c_sda"],
          },
          pin9: { isInput: true, capabilities: ["i2c_scl"] },
          pin10: {
            isOutput: true,
            canUseOpenDrain: true,
            isUsingOpenDrain: true,
          },
          pin11: { requiresGround: true },
          pin12: { requiresGround: true },
          pin13: {
            isOutput: true,
            canUseOpenDrain: true,
            isUsingOpenDrain: true,
          },
          pin14: { requiresGround: true },
          pin15: { isPassive: true },
          pin16: { requiresGround: true },
          pin17: { requiresGround: true },
          pin18: { isInput: true },
          pin19: {
            isOutput: true,
            canUseOpenDrain: true,
            isUsingOpenDrain: true,
          },
          pin20: { providesPower: true },
          pin21: { providesPower: true },
          pin22: { providesPower: true },
          pin23: { requiresPower: true },
          pin24: { requiresPower: true },
          pin25: { requiresPower: true },
          pin26: { isInput: true },
          pin27: { isInput: true },
          pin28: { isBidirectional: true },
          pin29: { isBidirectional: true },
          pin30: { isPassive: true },
          pin31: { requiresGround: true },
          pin32: { requiresPower: true },
          pin33: { requiresPower: true },
          pin34: { requiresGround: true },
          pin35: { requiresGround: true },
          pin36: { isInput: true },
          pin37: {
            isOutput: true,
            canUseOpenDrain: true,
            isUsingOpenDrain: true,
          },
          pin38: { requiresPower: true, shouldHaveDecouplingCapacitor: true },
          pin39: { requiresGround: true },
          pin40: { isPassive: true },
        }}
        manufacturerPartNumber="TPS25730DREFR"
      />
      <resistor
        name="R2"
        schX={-20.36223}
        schY={15.00056}
        resistance="10.0kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="RC0201FR-0710KL"
      />
      <resistor
        name="R9"
        schX={-20.36223}
        schY={4.5947}
        resistance="100kohm"
        symbolName="resistor"
        schRotation={180}
        manufacturerPartNumber="RC0201FR-07100KL"
      />
      <resistor
        name="R10"
        schX={-20.36223}
        schY={3.79462}
        resistance="100kohm"
        symbolName="resistor"
        schRotation={180}
        manufacturerPartNumber="RC0201FR-07100KL"
      />
      <resistor
        name="R13"
        schX={-10.36425}
        schY={-8.61285}
        resistance="100kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="RC0201FR-07100KL"
      />
      <resistor
        name="R14"
        schX={-8.76447}
        schY={-8.61285}
        resistance="100kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="RC0201FR-07100KL"
      />
      <resistor
        name="R17"
        schX={-3.96504}
        schY={-8.61285}
        resistance="100kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="RC0201FR-07100KL"
      />
      <resistor
        name="R18"
        schX={-2.36523}
        schY={-8.61285}
        resistance="100kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="RC0201FR-07100KL"
      />
      <resistor
        name="R21"
        schX={-21.96204}
        schY={-14.21706}
        resistance="100kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="RC0201FR-07100KL"
      />
      <capacitor
        name="C16"
        schX={-5.56485}
        schY={-1.60861}
        capacitance="10uF"
        schRotation={90}
        manufacturerPartNumber="CC0402MRX5R6BB106"
      />
      <capacitor
        name="C17"
        schX={-3.96507}
        schY={-1.60861}
        capacitance="10uF"
        schRotation={90}
        manufacturerPartNumber="CC0402MRX5R6BB106"
      />

      {/* Electrical connections transcribed from TI, including labeled nets. */}
      <trace from="U2.pin1" to="net.GND" />
      <trace from="U2.pin2" to="net.GND" />
      <trace from="U2.pin3" to="net.GND" />
      <trace from="U2.pin7" to="net.GND" />
      <trace from="C1.pin1" to={netSelector("730_VIN_3V3")} />
      <trace from="U1.pin38" to={netSelector("730_VIN_3V3")} />
      <trace from="J1.pin5" to="net.VBAT" />
      <trace from="J1.pin6" to="net.VBAT" />
      <trace from="D2.pin2" to="net.VBAT" />
      <trace from="C3.pin2" to="net.GND" />
      <trace from="C4.pin2" to="net.GND" />
      <trace from="C5.pin2" to="net.GND" />
      <trace from="C6.pin2" to="net.GND" />
      <trace from="C3.pin1" to={netSelector("730_VBUS")} />
      <trace from="C4.pin1" to={netSelector("730_VBUS")} />
      <trace from="C5.pin1" to={netSelector("730_VBUS")} />
      <trace from="C6.pin1" to={netSelector("730_VBUS")} />
      <trace from="L1.pin1" to={netSelector("730_VBUS")} />
      <trace from="U2.pin4" to={netSelector("730_VBUS")} />
      <trace from="U2.pin5" to={netSelector("730_VBUS")} />
      <trace from="U2.pin6" to={netSelector("730_VBUS")} />
      <trace from="C7.pin1" to={netSelector("730_VBUS")} />
      <trace from="C7.pin2" to="net.GND" />
      <trace from="J1.pin3" to="net.VSYS" />
      <trace from="J1.pin4" to="net.VSYS" />
      <trace from="D4.pin2" to="net.VSYS" />
      <trace from="TP1.pin1" to="net.VSYS" />
      <trace from="TP2.pin1" to={netSelector("730_PPHV")} />
      <trace from="TP3.pin1" to="net.GND" />
      <trace from="C8.pin2" to="net.GND" />
      <trace from="C9.pin2" to="net.GND" />
      <trace from="C10.pin2" to="net.GND" />
      <trace from="C11.pin2" to="net.GND" />
      <trace from="C12.pin2" to="net.GND" />
      <trace from="C13.pin2" to="net.GND" />
      <trace from="C15.pin1" to={netSelector("730_CC1")} />
      <trace from="U1.pin28" to={netSelector("730_CC1")} />
      <trace from="C14.pin1" to={netSelector("730_CC2")} />
      <trace from="U1.pin29" to={netSelector("730_CC2")} />
      <trace from="C14.pin2" to="net.GND" />
      <trace from="C15.pin2" to="net.GND" />
      <trace from="R1.pin2" to="net.P_ADCIN1" />
      <trace from="R5.pin1" to="net.P_ADCIN1" />
      <trace from="R1.pin1" to={netSelector("730_LDO_3V3")} />
      <trace from="R3.pin1" to={netSelector("730_LDO_3V3")} />
      <trace from="R4.pin1" to={netSelector("730_LDO_3V3")} />
      <trace from="R2.pin1" to={netSelector("730_LDO_3V3")} />
      <trace from="R6.pin1" to="net.P_ADCIN2" />
      <trace from="R2.pin2" to="net.P_ADCIN2" />
      <trace from="R11.pin2" to="net.GND" />
      <trace from="L1.pin2" to={netSelector("730_VBUS_IN")} />
      <trace from="D1.pin2" to={netSelector("730_VBUS_IN")} />
      <trace from="C2.pin1" to={netSelector("730_VBUS_IN")} />
      <trace from="U1.pin32" to={netSelector("730_VBUS_IN")} />
      <trace from="U1.pin23" to={netSelector("730_VBUS_IN")} />
      <trace from="U1.pin33" to={netSelector("730_VBUS_IN")} />
      <trace from="U1.pin24" to={netSelector("730_VBUS_IN")} />
      <trace from="U1.pin25" to={netSelector("730_VBUS_IN")} />
      <trace from="C2.pin2" to="net.GND" />
      <trace from="U1.pin11" to="net.GND" />
      <trace from="U1.pin12" to="net.GND" />
      <trace from="U1.pin14" to="net.GND" />
      <trace from="U1.pin16" to="net.GND" />
      <trace from="U1.pin17" to="net.GND" />
      <trace from="U1.pin31" to="net.GND" />
      <trace from="U1.pin34" to="net.GND" />
      <trace from="U1.pin39" to="net.GND" />
      <trace from="U1.pin35" to="net.GND" />
      <trace from="U1.pin15" to={netSelector("730_DRAIN")} />
      <trace from="U1.pin30" to={netSelector("730_DRAIN")} />
      <trace from="U1.pin40" to={netSelector("730_DRAIN")} />
      <trace from="U1.pin2" to="net.P_ADCIN1" />
      <trace from="U1.pin3" to="net.P_ADCIN2" />
      <trace from="U1.pin5" to="net.P_ADCIN3" />
      <trace from="U1.pin7" to="net.P_ADCIN4" />
      <trace from="R7.pin1" to="net.P_ADCIN3" />
      <trace from="R3.pin2" to="net.P_ADCIN3" />
      <trace from="R8.pin1" to="net.P_ADCIN4" />
      <trace from="R4.pin2" to="net.P_ADCIN4" />
      <trace from="R6.pin2" to="net.GND" />
      <trace from="R5.pin2" to="net.GND" />
      <trace from="R7.pin2" to="net.GND" />
      <trace from="R8.pin2" to="net.GND" />
      <trace from="U1.pin10" to="R9.pin1" />
      <trace from="U1.pin19" to="R10.pin1" />
      <trace from="R9.pin2" to="net.GND" />
      <trace from="R10.pin2" to="net.GND" />
      <trace from="D3.pin1" to="R19.pin1" />
      <trace from="Q1.source" to="net.GND" />
      <trace from="R21.pin2" to="net.GND" />
      <trace from="Q1.gate" to="U1.pin6" />
      <trace from="Q1.gate" to="R21.pin1" />
      <trace from="D3.pin2" to={netSelector("730_LDO_3V3")} />
      <trace from="C8.pin1" to={netSelector("730_PPHV")} />
      <trace from="C9.pin1" to={netSelector("730_PPHV")} />
      <trace from="J1.pin1" to={netSelector("730_PPHV")} />
      <trace from="J1.pin2" to={netSelector("730_PPHV")} />
      <trace from="C10.pin1" to={netSelector("730_PPHV")} />
      <trace from="C11.pin1" to={netSelector("730_PPHV")} />
      <trace from="C12.pin1" to={netSelector("730_PPHV")} />
      <trace from="C13.pin1" to={netSelector("730_PPHV")} />
      <trace from="U1.pin20" to={netSelector("730_PPHV")} />
      <trace from="U1.pin21" to={netSelector("730_PPHV")} />
      <trace from="U1.pin22" to={netSelector("730_PPHV")} />
      <trace from="R16.pin2" to={netSelector("730_LDO_3V3")} />
      <trace from="R15.pin2" to={netSelector("730_LDO_3V3")} />
      <trace from="R13.pin2" to={netSelector("730_LDO_3V3")} />
      <trace from="R14.pin2" to={netSelector("730_LDO_3V3")} />
      <trace from="R17.pin2" to={netSelector("730_LDO_3V3")} />
      <trace from="R18.pin2" to={netSelector("730_LDO_3V3")} />
      <trace from="R15.pin1" to="U1.pin8" />
      <trace from="R16.pin1" to="U1.pin9" />
      <trace from="U1.pin36" to="R17.pin1" />
      <trace from="U1.pin27" to="R13.pin1" />
      <trace from="U1.pin26" to="R14.pin1" />
      <trace from="U1.pin18" to="R18.pin1" />
      <trace from="U1.pin4" to={netSelector("730_LDO_1V5")} />
      <trace from="C16.pin2" to={netSelector("730_LDO_1V5")} />
      <trace from="U1.pin1" to={netSelector("730_LDO_3V3")} />
      <trace from="C17.pin2" to={netSelector("730_LDO_3V3")} />
      <trace from="C1.pin2" to="net.GND" />
      <trace from="D4.pin1" to="R20.pin1" />
      <trace from="R20.pin2" to="net.GND" />
      <trace from="D1.pin1" to="R11.pin1" />
      <trace from="R12.pin1" to="D2.pin1" />
      <trace from="R12.pin2" to="net.GND" />
      <trace from="Q1.drain" to="R19.pin2" />
      <trace from="C16.pin1" to="net.GND" />
      <trace from="C17.pin1" to="net.GND" />

      {/* Preserve additional TI net aliases through electrical connections. */}

      {/* TI section outlines and configuration-table borders. */}
      <schematicbox
        schX={9.0334}
        schY={-9.61426}
        width={15.59645}
        height={12.40747}
      />
      <schematicbox
        schX={17.63151}
        schY={13.99996}
        width={7.99902}
        height={4.40263}
      />
      <schematicbox
        schX={1.83427}
        schY={13.19946}
        width={17.19623}
        height={6.00364}
      />
      <schematictext
        text={"Place capacitors close to chip"}
        schX={2.15046}
        schY={1.18367}
        fontSize={0.36031}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"VSYSLEDIndicator"}
        schX={11.44078}
        schY={-13.06139}
        fontSize={0.36021}
        anchor="center"
        schRotation={90}
      />
      <schematictext
        text={"SELECTOR BATTERY VS TYPE-C"}
        schX={9.47301}
        schY={-16.80989}
        fontSize={1.16101}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"Test Points"}
        schX={17.7792}
        schY={16.81039}
        fontSize={1.16101}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"ADCINx CONFIG"}
        schX={1.64939}
        schY={16.81039}
        fontSize={1.16101}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"Decoded ADCINx"}
        schX={-4.77261}
        schY={15.39439}
        fontSize={0.36031}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"3"}
        schX={-3.571}
        schY={14.59177}
        fontSize={0.36031}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"7"}
        schX={-3.571}
        schY={13.79127}
        fontSize={0.36031}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"ADCIN1:"}
        schX={-5.55674}
        schY={14.59177}
        fontSize={0.36031}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"ADCIN2:"}
        schX={-5.55674}
        schY={13.79127}
        fontSize={0.36031}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"TypeCLEDIndicator"}
        schX={9.84094}
        schY={1.91377}
        fontSize={0.36021}
        anchor="center"
        schRotation={90}
      />
      <schematictext
        text={"VBATLEDIndicator"}
        schX={11.44078}
        schY={-6.25051}
        fontSize={0.36021}
        anchor="center"
        schRotation={90}
      />
      <schematictext
        text={"Configuration"}
        schX={3.64264}
        schY={15.39439}
        fontSize={0.36031}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"ADCIN3:"}
        schX={-5.55665}
        schY={12.99077}
        fontSize={0.36031}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"ADCIN4:"}
        schX={-5.55665}
        schY={12.19033}
        fontSize={0.36031}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"Minimum Voltage Configuration:"}
        schX={1.63346}
        schY={14.59177}
        fontSize={0.36031}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"15V"}
        schX={6.84158}
        schY={14.59177}
        fontSize={0.36031}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"Maximum Voltage Configuration"}
        schX={1.62431}
        schY={13.79127}
        fontSize={0.36031}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"20V"}
        schX={6.84158}
        schY={13.79127}
        fontSize={0.36031}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"3"}
        schX={-3.57074}
        schY={12.99077}
        fontSize={0.36031}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"3"}
        schX={-3.57074}
        schY={12.19033}
        fontSize={0.36031}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"Operating Current:"}
        schX={1.64318}
        schY={12.99077}
        fontSize={0.36031}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"Maximum Current:"}
        schX={1.64321}
        schY={12.19033}
        fontSize={0.36031}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"Minimum Power Required:"}
        schX={1.64681}
        schY={11.38983}
        fontSize={0.36031}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"3A"}
        schX={6.8347}
        schY={12.99077}
        fontSize={0.36031}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"5A"}
        schX={6.8347}
        schY={12.19033}
        fontSize={0.36031}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"45W"}
        schX={6.82151}
        schY={11.38983}
        fontSize={0.36031}
        anchor="center"
        schRotation={0}
      />
    </schematicsheet>
  )
}
