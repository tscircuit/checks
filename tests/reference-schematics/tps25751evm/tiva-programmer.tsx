// TI SLVUCP9B, figure 5-7, page 44.
// TI layout with documented native-symbol spacing/alignment adjustments.
import { netSelector } from "./net-selector"

export function TivaProgrammer() {
  return (
    <schematicsheet
      name="tiva-programmer"
      displayName="TIVA Programmer"
      sheetIndex={7}
      sheetWidth={700.04}
      sheetHeight={484.77}
    >
      <chip
        name="U6"
        schX={16.69558}
        schY={21.70265}
        pinLabels={{ pin1: "D_P", pin2: "D_N", pin3: "GND" }}
        schPinArrangement={{
          leftSide: { pins: ["pin1"], direction: "top-to-bottom" },
          rightSide: { pins: ["pin3", "pin2"], direction: "bottom-to-top" },
        }}
        schPinStyle={{
          pin1: { topMargin: 0, bottomMargin: 0.80036 },
          pin3: { bottomMargin: 0 },
          pin2: { bottomMargin: 0.60037, topMargin: 1e-5 },
        }}
        schWidth={3.99917}
        schHeight={2.40112}
        pinAttributes={{
          pin1: { isPassive: true },
          pin2: { isPassive: true },
          pin3: { requiresGround: true },
        }}
        manufacturerPartNumber="TPD2E009DRTR"
      />
      <capacitor
        name="C32"
        schX={3.89856}
        schY={16.30022}
        capacitance="0.1uF"
        schRotation={270}
        manufacturerPartNumber="CL03A104KP3NNNC"
      />
      <capacitor
        name="C33"
        schX={5.49744}
        schY={16.30022}
        capacitance="0.1uF"
        schRotation={270}
        manufacturerPartNumber="CL03A104KP3NNNC"
      />
      <capacitor
        name="C34"
        schX={7.09718}
        schY={16.30022}
        capacitance="0.1uF"
        schRotation={270}
        manufacturerPartNumber="CL03A104KP3NNNC"
      />
      <capacitor
        name="C35"
        schX={8.69692}
        schY={16.30022}
        capacitance="0.1uF"
        schRotation={270}
        manufacturerPartNumber="CL03A104KP3NNNC"
      />
      <capacitor
        name="C40"
        schX={7.49711}
        schY={12.69861}
        capacitance="0.1uF"
        schRotation={270}
        manufacturerPartNumber="CL03A104KP3NNNC"
      />
      <capacitor
        name="C38"
        schX={3.89856}
        schY={12.69861}
        capacitance="0.1uF"
        schRotation={270}
        manufacturerPartNumber="CL03A104KP3NNNC"
      />
      <capacitor
        name="C37"
        schX={2.29967}
        schY={12.69861}
        capacitance="4.7uF"
        schRotation={270}
        manufacturerPartNumber="GRM035R60J475ME15D"
      />
      <capacitor
        name="C39"
        schX={5.8974}
        schY={12.69861}
        capacitance="4.7uF"
        schRotation={270}
        manufacturerPartNumber="GRM035R60J475ME15D"
      />
      <pushbutton
        name="S3"
        schX={-7.65867}
        schY={14.50023}
        schRotation={270}
        manufacturerPartNumber="B3U-1000P"
      />
      <chip
        name="U7"
        schX={16.69561}
        schY={8.49755}
        pinLabels={{
          pin1: "PB6",
          pin2: "VDDA",
          pin3: "GNDA",
          pin4: "PB7",
          pin5: "PF4",
          pin6: "PE3",
          pin7: "PE2",
          pin8: "PE1",
          pin9: "PE0",
          pin10: "PD7",
          pin11: "VDD",
          pin12: "GND",
          pin13: "PC7",
          pin14: "PC6",
          pin15: "PC5",
          pin16: "PC4",
          pin17: "PA0_U0Rx",
          pin18: "PA1_U0Tx",
          pin19: "PA2_SSI0Clk",
          pin20: "PA3_SSI0Fss",
          pin21: "PA4_SSI0Rx",
          pin22: "PA5_SSI0Tx",
          pin23: "PA6",
          pin24: "PA7",
          pin25: "VDDC",
          pin26: "VDD",
          pin27: "GND",
          pin28: "PF0",
          pin29: "PF1",
          pin30: "PF2",
          pin31: "PF3",
          pin32: "WAKE",
          pin33: "HIB",
          pin34: "XOSC0",
          pin35: "GNDX",
          pin36: "XOSC1",
          pin37: "VBAT",
          pin38: "RST",
          pin39: "GND",
          pin40: "OSC0",
          pin41: "OSC1",
          pin42: "VDD",
          pin43: "PD4",
          pin44: "PD5",
          pin45: "PB0_USB0VID",
          pin46: "PB1_USB0VBUS",
          pin47: "PB2_I2C0SCL",
          pin48: "PB3_I2C0SDA",
          pin49: "PC3_TDO_SWO",
          pin50: "PC2_TDI",
          pin51: "PC1_TMS_SWDIO",
          pin52: "PC0_TCK_SWCLK",
          pin53: "PD6",
          pin54: "VDD",
          pin55: "GND",
          pin56: "VDDC",
          pin57: "PB5",
          pin58: "PB4",
          pin59: "PE4",
          pin60: "PE5",
          pin61: "PD0",
          pin62: "PD1",
          pin63: "PD2",
          pin64: "PD3",
        }}
        schPinArrangement={{
          leftSide: {
            pins: [
              "pin11",
              "pin26",
              "pin42",
              "pin54",
              "pin2",
              "pin25",
              "pin56",
              "pin37",
              "pin32",
              "pin38",
              "pin40",
              "pin41",
              "pin17",
              "pin18",
              "pin19",
              "pin20",
              "pin21",
              "pin22",
              "pin23",
              "pin24",
              "pin45",
              "pin46",
              "pin47",
              "pin48",
              "pin58",
              "pin57",
              "pin1",
              "pin4",
            ],
            direction: "top-to-bottom",
          },
          rightSide: {
            pins: [
              "pin55",
              "pin39",
              "pin27",
              "pin12",
              "pin3",
              "pin35",
              "pin5",
              "pin31",
              "pin30",
              "pin29",
              "pin28",
              "pin60",
              "pin59",
              "pin6",
              "pin7",
              "pin8",
              "pin9",
              "pin10",
              "pin53",
              "pin44",
              "pin43",
              "pin64",
              "pin63",
              "pin62",
              "pin61",
              "pin13",
              "pin14",
              "pin15",
              "pin16",
              "pin49",
              "pin50",
              "pin51",
              "pin52",
              "pin36",
              "pin34",
              "pin33",
            ],
            direction: "bottom-to-top",
          },
        }}
        schPinStyle={{
          pin11: { topMargin: 0 },
          pin26: { topMargin: 0.20019 },
          pin42: { topMargin: 0.20018 },
          pin54: { topMargin: 0.20019 },
          pin2: { topMargin: 1.00055 },
          pin25: { topMargin: 0.60031 },
          pin56: { topMargin: 0.20019 },
          pin37: { topMargin: 0.60037 },
          pin32: { topMargin: 0.60037 },
          pin38: { topMargin: 0.60037 },
          pin40: { topMargin: 0.60037 },
          pin41: { topMargin: 0.60037 },
          pin17: { topMargin: 1.00049 },
          pin18: { topMargin: 0.20019 },
          pin19: { topMargin: 0.20018 },
          pin20: { topMargin: 0.20019 },
          pin21: { topMargin: 0.19848 },
          pin22: { topMargin: 0.20019 },
          pin23: { topMargin: 0.20018 },
          pin24: { topMargin: 0.20019 },
          pin45: { topMargin: 1.00056 },
          pin46: { topMargin: 0.20018 },
          pin47: { topMargin: 0.20019 },
          pin48: { topMargin: 0.20018 },
          pin58: { topMargin: 0.20019 },
          pin57: { topMargin: 0.20018 },
          pin1: { topMargin: 0.20012 },
          pin4: { topMargin: 0.20025, bottomMargin: 1.2005 },
          pin55: { bottomMargin: 1e-5 },
          pin39: { bottomMargin: 0.20018 },
          pin27: { bottomMargin: 0.20018 },
          pin12: { bottomMargin: 0.20013 },
          pin3: { bottomMargin: 0.20025 },
          pin35: { bottomMargin: 0.20012 },
          pin5: { bottomMargin: 0.60037 },
          pin31: { bottomMargin: 0.20018 },
          pin30: { bottomMargin: 0.20019 },
          pin29: { bottomMargin: 0.20018 },
          pin28: { bottomMargin: 0.20019 },
          pin60: { bottomMargin: 0.60037 },
          pin59: { bottomMargin: 0.20019 },
          pin6: { bottomMargin: 0.20018 },
          pin7: { bottomMargin: 0.20019 },
          pin8: { bottomMargin: 0.19848 },
          pin9: { bottomMargin: 0.20019 },
          pin10: { bottomMargin: 0.60037 },
          pin53: { bottomMargin: 0.20018 },
          pin44: { bottomMargin: 0.20019 },
          pin43: { bottomMargin: 0.20012 },
          pin64: { bottomMargin: 0.20018 },
          pin63: { bottomMargin: 0.20019 },
          pin62: { bottomMargin: 0.20019 },
          pin61: { bottomMargin: 0.20018 },
          pin13: { bottomMargin: 0.60037 },
          pin14: { bottomMargin: 0.20019 },
          pin15: { bottomMargin: 0.20018 },
          pin16: { bottomMargin: 0.20019 },
          pin49: { bottomMargin: 0.20018 },
          pin50: { bottomMargin: 0.20019 },
          pin51: { bottomMargin: 0.20012 },
          pin52: { bottomMargin: 0.20019 },
          pin36: { bottomMargin: 0.60037 },
          pin34: { bottomMargin: 0.60037 },
          pin33: { bottomMargin: 0.60037, topMargin: 0 },
        }}
        schWidth={7.99851}
        schHeight={18.40664}
        pinAttributes={{
          pin1: { isBidirectional: true, isGpio: true },
          pin2: { requiresPower: true, shouldHaveDecouplingCapacitor: true },
          pin3: { requiresGround: true },
          pin4: { isBidirectional: true, isGpio: true },
          pin5: { isBidirectional: true, isGpio: true },
          pin6: { isBidirectional: true, isGpio: true },
          pin7: { isBidirectional: true, isGpio: true },
          pin8: { isBidirectional: true, isGpio: true },
          pin9: { isBidirectional: true, isGpio: true },
          pin10: { isBidirectional: true, isGpio: true },
          pin11: { requiresPower: true, shouldHaveDecouplingCapacitor: true },
          pin12: { requiresGround: true },
          pin13: { isBidirectional: true, isGpio: true },
          pin14: { isBidirectional: true, isGpio: true },
          pin15: { isBidirectional: true, isGpio: true },
          pin16: { isBidirectional: true, isGpio: true },
          pin17: { isBidirectional: true, isGpio: true },
          pin18: { isBidirectional: true, isGpio: true },
          pin19: { isBidirectional: true, isGpio: true },
          pin20: { isBidirectional: true, isGpio: true },
          pin21: { isBidirectional: true, isGpio: true },
          pin22: { isBidirectional: true, isGpio: true },
          pin23: { isBidirectional: true, isGpio: true },
          pin24: { isBidirectional: true, isGpio: true },
          pin25: {
            providesPower: true,
            providesVoltage: "1.2V",
            shouldHaveDecouplingCapacitor: true,
          },
          pin26: { requiresPower: true, shouldHaveDecouplingCapacitor: true },
          pin27: { requiresGround: true },
          pin28: { isBidirectional: true, isGpio: true },
          pin29: { isBidirectional: true, isGpio: true },
          pin30: { isBidirectional: true, isGpio: true },
          pin31: { isBidirectional: true, isGpio: true },
          pin32: { isInput: true },
          pin33: { isOutput: true },
          pin34: { isInput: true },
          pin35: { requiresGround: true },
          pin36: { isOutput: true },
          pin37: { requiresPower: true, shouldHaveDecouplingCapacitor: true },
          pin38: { isInput: true },
          pin39: { requiresGround: true },
          pin40: { isInput: true },
          pin41: { isOutput: true },
          pin42: { requiresPower: true, shouldHaveDecouplingCapacitor: true },
          pin43: { isBidirectional: true, isGpio: true },
          pin44: { isBidirectional: true, isGpio: true },
          pin45: { isBidirectional: true, isGpio: true },
          pin46: { isBidirectional: true, isGpio: true },
          pin47: { isBidirectional: true, isGpio: true },
          pin48: { isBidirectional: true, isGpio: true },
          pin49: { isBidirectional: true, isGpio: true },
          pin50: { isBidirectional: true, isGpio: true },
          pin51: { isBidirectional: true, isGpio: true },
          pin52: { isBidirectional: true, isGpio: true },
          pin53: { isBidirectional: true, isGpio: true },
          pin54: { requiresPower: true, shouldHaveDecouplingCapacitor: true },
          pin55: { requiresGround: true },
          pin56: {
            providesPower: true,
            providesVoltage: "1.2V",
            shouldHaveDecouplingCapacitor: true,
          },
          pin57: { isBidirectional: true, isGpio: true },
          pin58: { isBidirectional: true, isGpio: true },
          pin59: { isBidirectional: true, isGpio: true },
          pin60: { isBidirectional: true, isGpio: true },
          pin61: { isBidirectional: true, isGpio: true },
          pin62: { isBidirectional: true, isGpio: true },
          pin63: { isBidirectional: true, isGpio: true },
          pin64: { isBidirectional: true, isGpio: true },
        }}
        manufacturerPartNumber="TM4C123GH6PMTR"
      />
      <crystal
        name="Y1"
        schX={-0.09995}
        schY={7.89645}
        frequency="16MHz"
        loadCapacitance="8pF"
        pinVariant="four_pin"
        manufacturerPartNumber="NX3225GA-16.000M-STD-CRG-1"
      />
      <capacitor
        name="C42"
        schX={0.10004}
        schY={6.09729}
        capacitance="10pF"
        schRotation={180}
        manufacturerPartNumber="C0402C100K4GACTU"
      />
      <capacitor
        name="C41"
        schX={0.10004}
        schY={9.69725}
        capacitance="10pF"
        schRotation={180}
        manufacturerPartNumber="C0402C100K4GACTU"
      />
      <resistor
        name="R86"
        schX={26.69223}
        schY={15.69994}
        resistance="10.0kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW040210K0FKED"
      />
      <resistor
        name="R87"
        schX={27.89208}
        schY={15.69994}
        resistance="10.0kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW040210K0FKED"
      />
      <resistor
        name="R92"
        schX={10.69658}
        schY={8.09651}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={180}
        manufacturerPartNumber="CRCW02010000Z0ED"
      />
      {/* Separate adjacent reference/value text while retaining the center of this resistor group. */}
      <resistor
        name="R94"
        schX={10.69658}
        schY={5.6971}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={180}
        manufacturerPartNumber="CRCW02010000Z0ED"
      />
      {/* Separate adjacent reference/value text while retaining the center of this resistor group. */}
      <resistor
        name="R96"
        schX={10.69658}
        schY={4.7971}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={180}
        manufacturerPartNumber="CRCW02010000Z0ED"
      />
      {/* Separate adjacent reference/value text while retaining the center of this resistor group. */}
      <resistor
        name="R98"
        schX={10.69658}
        schY={3.54595}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={180}
        manufacturerPartNumber="CRCW02010000Z0ED"
      />
      {/* Separate adjacent reference/value text while retaining the center of this resistor group. */}
      <resistor
        name="R99"
        schX={10.69658}
        schY={2.64594}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={180}
        manufacturerPartNumber="CRCW02010000Z0ED"
      />
      {/* Separate adjacent reference/value text while retaining the center of this resistor group. */}
      <resistor
        name="R93"
        schX={10.69658}
        schY={6.5971}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={180}
        manufacturerPartNumber="CRCW02010000Z0ED"
      />
      {/* Separate adjacent reference/value text while retaining the center of this resistor group. */}
      <resistor
        name="R89"
        schX={22.69628}
        schY={11.74796}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={180}
        manufacturerPartNumber="CRCW02010000Z0ED"
      />
      {/* Separate adjacent reference/value text while retaining the center of this resistor group. */}
      <resistor
        name="R90"
        schX={22.69628}
        schY={10.84796}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={180}
        manufacturerPartNumber="CRCW02010000Z0ED"
      />
      {/* Separate adjacent reference/value text while retaining the center of this resistor group. */}
      <resistor
        name="R91"
        schX={22.69628}
        schY={9.94796}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={180}
        manufacturerPartNumber="CRCW02010000Z0ED"
      />
      <capacitor
        name="C48"
        schX={-29.29343}
        schY={-5.30784}
        capacitance="1uF"
        schRotation={270}
        manufacturerPartNumber="CGA3E3X5R1H105M080AB"
      />
      <capacitor
        name="C44"
        schX={-27.29377}
        schY={-5.30784}
        capacitance="0.01uF"
        schRotation={270}
        manufacturerPartNumber="C0402C103J5RACTU"
      />
      <capacitor
        name="C45"
        schX={-25.29407}
        schY={-5.30784}
        capacitance="0.01uF"
        schRotation={270}
        manufacturerPartNumber="C0402C103J5RACTU"
      />
      <capacitor
        name="C46"
        schX={-23.29441}
        schY={-5.30784}
        capacitance="0.01uF"
        schRotation={270}
        manufacturerPartNumber="C0402C103J5RACTU"
      />
      <capacitor
        name="C47"
        schX={-21.29474}
        schY={-5.30784}
        capacitance="0.01uF"
        schRotation={270}
        manufacturerPartNumber="C0402C103J5RACTU"
      />
      <chip
        name="L6"
        schX={-11.29809}
        schY={-2.70667}
        noSchematicRepresentation
        pinLabels={{ pin1: "1", pin2: "2" }}
        schRotation={180}
        pinAttributes={{ pin1: { isPassive: true }, pin2: { isPassive: true } }}
        manufacturerPartNumber="742792021"
      />
      <schematicsymbol
        name="L6_symbol"
        displayName="L6 22ohm"
        chipRef="chip.L6"
        symbolName="ferrite_bead"
        schX={-11.29809}
        schY={-2.70667}
        schRotation={180}
        connections={{ pin1: ".L6 > .pin1", pin2: ".L6 > .pin2" }}
      />
      <chip
        name="U9"
        schX={-18.49522}
        schY={-5.50796}
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
          pin4: { rightMargin: 0.0017 },
          pin5: { rightMargin: 0.19993 },
          pin6: { rightMargin: 0.19993, leftMargin: 0 },
          pin7: { leftMargin: 0 },
          pin3: { leftMargin: 0.19992 },
          pin2: { leftMargin: 0.19993 },
          pin1: { leftMargin: 0.19993, rightMargin: 0.39992 },
        }}
        schWidth={2.39956}
        schHeight={4.80253}
        pinAttributes={{
          pin1: { requiresGround: true },
          pin2: { requiresGround: true },
          pin3: { requiresGround: true },
          pin4: { isPassive: true },
          pin5: { isPassive: true },
          pin6: { isPassive: true },
          pin7: { requiresGround: true },
        }}
        manufacturerPartNumber="TVS0500DRVR"
      />
      <chip
        name="U8"
        schX={-4.49921}
        schY={-3.90722}
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
          pin3: { topMargin: 1.40067, bottomMargin: 0.80037 },
          pin2: { bottomMargin: 0 },
          pin5: { bottomMargin: 0.60037 },
          pin1: { bottomMargin: 1.40067, topMargin: 0 },
        }}
        schWidth={4.79903}
        schHeight={4.00179}
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
      <capacitor
        name="C49"
        schX={-8.49854}
        schY={-5.30784}
        capacitance="1uF"
        schRotation={270}
        manufacturerPartNumber="C1005X6S1C105K050BC"
      />
      <capacitor
        name="C43"
        schX={1.49978}
        schY={-4.50747}
        capacitance="1uF"
        schRotation={270}
        manufacturerPartNumber="C1005X6S1C105K050BC"
      />
      <resistor
        name="R100"
        schX={-13.69768}
        schY={-6.70849}
        resistance="10.0kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW040210K0FKED"
      />
      {/* Align the native LED terminals with its series resistor. */}
      <led
        name="D11"
        schX={-13.69768}
        schY={-4.30741}
        color="blue"
        pinLabels={{ pin1: ["cathode", "neg"], pin2: ["anode", "pos"] }}
        schRotation={270}
        manufacturerPartNumber="150060BS75000"
      />
      <capacitor
        name="C56"
        schX={21.09487}
        schY={-7.70892}
        capacitance="0.1uF"
        schRotation={270}
        manufacturerPartNumber="CGA2B3X7R1H104K050BB"
      />
      <capacitor
        name="C57"
        schX={22.69628}
        schY={-7.71059}
        capacitance="0.1uF"
        schRotation={270}
        manufacturerPartNumber="CGA2B3X7R1H104K050BB"
      />
      <capacitor
        name="C50"
        schX={11.49647}
        schY={-7.70892}
        capacitance="0.1uF"
        schRotation={270}
        manufacturerPartNumber="CGA2B3X7R1H104K050BB"
      />
      <capacitor
        name="C51"
        schX={13.09618}
        schY={-7.70892}
        capacitance="0.1uF"
        schRotation={270}
        manufacturerPartNumber="CGA2B3X7R1H104K050BB"
      />
      <capacitor
        name="C52"
        schX={14.69592}
        schY={-7.70892}
        capacitance="0.1uF"
        schRotation={270}
        manufacturerPartNumber="CGA2B3X7R1H104K050BB"
      />
      <capacitor
        name="C53"
        schX={16.29566}
        schY={-7.70892}
        capacitance="0.1uF"
        schRotation={270}
        manufacturerPartNumber="CGA2B3X7R1H104K050BB"
      />
      <capacitor
        name="C54"
        schX={17.89539}
        schY={-7.70892}
        capacitance="0.1uF"
        schRotation={270}
        manufacturerPartNumber="CGA2B3X7R1H104K050BB"
      />
      <capacitor
        name="C55"
        schX={19.49513}
        schY={-7.70892}
        capacitance="0.1uF"
        schRotation={270}
        manufacturerPartNumber="CGA2B3X7R1H104K050BB"
      />
      <capacitor
        name="C58"
        schX={24.29434}
        schY={-7.71059}
        capacitance="1uF"
        schRotation={270}
        manufacturerPartNumber="C1005X6S1C105K050BC"
      />
      <connector
        name="J11"
        schX={29.09185}
        schY={13.89914}
        pinLabels={{
          pin4: "ICD_TDO",
          pin1: "ICD_TCK",
          pin2: "ICD_TMS",
          pin3: "ICD_TDI",
        }}
        schPinArrangement={{
          leftSide: {
            pins: ["pin1", "pin2", "pin3", "pin4"],
            direction: "top-to-bottom",
          },
        }}
        schPinStyle={{
          pin1: { topMargin: 0 },
          pin2: { topMargin: 0.20019 },
          pin3: { topMargin: 0.20012 },
          pin4: { topMargin: 0.20019, bottomMargin: 0 },
        }}
        schWidth={1.215}
        schHeight={2.00086}
        pinAttributes={{
          pin4: { isPassive: true },
          pin1: { isPassive: true },
          pin2: { isPassive: true },
          pin3: { isPassive: true },
        }}
        manufacturerPartNumber="350-10-104-00-006000"
      />
      {/* Align the reset pull-up resistor with the native pushbutton terminal. */}
      <resistor
        name="R85"
        schX={-7.65867}
        schY={17.70087}
        resistance="1.02kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="RC0201FR-071K02L"
      />
      <capacitor
        name="C36"
        schX={-4.09928}
        schY={14.69947}
        capacitance="1uF"
        schRotation={270}
        manufacturerPartNumber="C1005X6S1C105K050BC"
      />
      <diode
        name="D10"
        schX={-4.09928}
        schY={17.90092}
        variant="schottky"
        pinLabels={{ pin1: ["cathode", "neg"], pin2: ["anode", "pos"] }}
        schRotation={270}
        manufacturerPartNumber="MBR0520LT1G"
      />
      {/* Separate adjacent reference/value text while retaining the center of this resistor group. */}
      <resistor
        name="R88"
        schX={22.69628}
        schY={12.64796}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={180}
        manufacturerPartNumber="CRCW02010000Z0ED"
      />
      {/* Separate adjacent reference/value text while retaining the center of this resistor group. */}
      <resistor
        name="R97"
        schX={22.69628}
        schY={5.04537}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={180}
        manufacturerPartNumber="CRCW02010000Z0ED"
      />
      {/* Separate adjacent reference/value text while retaining the center of this resistor group. */}
      <resistor
        name="R95"
        schX={22.69628}
        schY={5.94537}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={180}
        manufacturerPartNumber="CRCW02010000Z0ED"
      />

      {/* Electrical connections transcribed from TI, including labeled nets. */}
      <trace from="U6.pin2" to="net.TIVA_D_N" />
      <trace from="U6.pin3" to="net.GND" />
      <trace from="C32.pin2" to="net.GND" />
      <trace from="C33.pin2" to="net.GND" />
      <trace from="C34.pin2" to="net.GND" />
      <trace from="C35.pin2" to="net.GND" />
      <trace from="C38.pin1" to="C37.pin1" />
      <trace from="C38.pin1" to="U7.pin25" />
      <trace from="C40.pin2" to="net.GND" />
      <trace from="C39.pin2" to="net.GND" />
      <trace from="U7.pin32" to="net.GND" />
      <trace from="Y1.pin4" to="net.GND" />
      <trace from="Y1.pin2" to="net.GND" />
      <trace from="C42.pin2" to="net.GND" />
      <trace from="C41.pin2" to="net.GND" />
      <trace from="C32.pin1" to="net.TIVA_P3V3" />
      <trace from="C33.pin1" to="net.TIVA_P3V3" />
      <trace from="C34.pin1" to="net.TIVA_P3V3" />
      <trace from="C35.pin1" to="net.TIVA_P3V3" />
      <trace from="U7.pin2" to="net.TIVA_P3V3" />
      <trace from="U7.pin11" to="net.TIVA_P3V3" />
      <trace from="U7.pin26" to="net.TIVA_P3V3" />
      <trace from="U7.pin37" to="net.TIVA_P3V3" />
      <trace from="U7.pin42" to="net.TIVA_P3V3" />
      <trace from="U7.pin54" to="net.TIVA_P3V3" />
      <trace from="C38.pin2" to="net.GND" />
      <trace from="C37.pin2" to="net.GND" />
      <trace from="U7.pin38" to="net.T_RST" />
      <trace from="U7.pin40" to="Y1.pin3" />
      <trace from="U7.pin40" to="C41.pin1" />
      <trace from="U7.pin41" to="Y1.pin1" />
      <trace from="U7.pin41" to="C42.pin1" />
      <trace from="U7.pin50" to="net.ICD_TDI" />
      <trace from="J11.pin3" to="net.ICD_TDI" />
      <trace from="U7.pin49" to="net.ICD_TDO" />
      <trace from="J11.pin4" to="net.ICD_TDO" />
      <trace from="U7.pin3" to="net.GND" />
      <trace from="U7.pin12" to="net.GND" />
      <trace from="U7.pin27" to="net.GND" />
      <trace from="U7.pin35" to="net.GND" />
      <trace from="U7.pin39" to="net.GND" />
      <trace from="U7.pin55" to="net.GND" />
      <trace from="U7.pin34" to="net.GND" />
      <trace from="R86.pin1" to="net.TIVA_P3V3" />
      <trace from="R87.pin1" to="net.TIVA_P3V3" />
      <trace from="U7.pin52" to="net.ICD_TCK" />
      <trace from="R87.pin2" to="net.ICD_TCK" />
      <trace from="J11.pin1" to="net.ICD_TCK" />
      <trace from="U7.pin51" to="net.ICD_TMS" />
      <trace from="R86.pin2" to="net.ICD_TMS" />
      <trace from="J11.pin2" to="net.ICD_TMS" />
      <trace from="S3.pin2" to="net.GND" />
      <trace from="C36.pin2" to="net.GND" />
      <trace from="C40.pin1" to="C39.pin1" />
      <trace from="C40.pin1" to="U7.pin56" />
      <trace from="R92.pin2" to="net.DBG_UART" />
      <trace from="U7.pin17" to="R92.pin1" />
      <trace from="R98.pin2" to="net.I2Cc_SCL" />
      <trace from="R99.pin2" to="net.I2Cc_SDA" />
      <trace from="U7.pin48" to="R99.pin1" />
      <trace from="U7.pin47" to="R98.pin1" />
      <trace from="U7.pin23" to="R94.pin1" />
      <trace from="U7.pin24" to="R96.pin1" />
      <trace from="R94.pin2" to="net.I2Ct_SCL" />
      <trace from="R96.pin2" to="net.I2Ct_SDA" />
      <trace from="R93.pin2" to="net.I2Cc_IRQ" />
      <trace from="U7.pin22" to="R93.pin1" />
      <trace from="U7.pin13" to="R89.pin2" />
      <trace from="R89.pin1" to="net.I2Ct_IRQ" />
      <trace from="U7.pin61" to="R90.pin2" />
      <trace from="U7.pin62" to="R91.pin2" />
      <trace from="R91.pin1" to="net.DBG_SDA" />
      <trace from="R90.pin1" to="net.DBG_SCL" />
      <trace from="C48.pin2" to="net.GND" />
      <trace from="C44.pin2" to="net.GND" />
      <trace from="C45.pin2" to="net.GND" />
      <trace from="C46.pin2" to="net.GND" />
      <trace from="C47.pin2" to="net.GND" />
      <trace from="U9.pin1" to="net.GND" />
      <trace from="U9.pin2" to="net.GND" />
      <trace from="U9.pin3" to="net.GND" />
      <trace from="U9.pin7" to="net.GND" />
      <trace from="C48.pin1" to="net.TIVA_VBUS" />
      <trace from="C44.pin1" to="net.TIVA_VBUS" />
      <trace from="C45.pin1" to="net.TIVA_VBUS" />
      <trace from="C46.pin1" to="net.TIVA_VBUS" />
      <trace from="C47.pin1" to="net.TIVA_VBUS" />
      <trace from="L6.pin2" to="net.TIVA_VBUS" />
      <trace from="U9.pin4" to="net.TIVA_VBUS" />
      <trace from="U9.pin5" to="net.TIVA_VBUS" />
      <trace from="U9.pin6" to="net.TIVA_VBUS" />
      <trace from="D11.pin2" to="net.TIVA_VBUS" />
      <trace from="C49.pin2" to="net.GND" />
      <trace from="L6.pin1" to="net.TIVA_5V" />
      <trace from="U8.pin3" to="net.TIVA_5V" />
      <trace from="U8.pin4" to="net.TIVA_5V" />
      <trace from="C49.pin1" to="net.TIVA_5V" />
      <trace from="U8.pin2" to="net.GND" />
      <trace from="U8.pin5" to="net.GND" />
      <trace from="C43.pin2" to="net.GND" />
      <trace from="U8.pin1" to="net.TIVA_P3V3" />
      <trace from="C43.pin1" to="net.TIVA_P3V3" />
      <trace from="R100.pin2" to="net.GND" />
      <trace from="R100.pin1" to="D11.pin1" />
      <trace from="C56.pin1" to="net.TIVA_P3V3" />
      <trace from="C57.pin1" to="net.TIVA_P3V3" />
      <trace from="C50.pin1" to="net.TIVA_P3V3" />
      <trace from="C51.pin1" to="net.TIVA_P3V3" />
      <trace from="C52.pin1" to="net.TIVA_P3V3" />
      <trace from="C53.pin1" to="net.TIVA_P3V3" />
      <trace from="C54.pin1" to="net.TIVA_P3V3" />
      <trace from="C55.pin1" to="net.TIVA_P3V3" />
      <trace from="C58.pin1" to="net.TIVA_P3V3" />
      <trace from="U6.pin1" to="net.TIVA_D_P" />
      <trace from="S3.pin1" to="net.T_RST" />
      <trace from="R85.pin2" to="net.T_RST" />
      <trace from="C36.pin1" to="net.T_RST" />
      <trace from="D10.pin1" to="net.T_RST" />
      <trace from="R85.pin1" to="net.TIVA_P3V3" />
      <trace from="D10.pin2" to="net.TIVA_P3V3" />
      <trace from="U7.pin14" to="R88.pin2" />
      <trace from="R88.pin1" to="net.A_GPIO11" />
      <trace from="R97.pin1" to="net.TEST1" />
      <trace from="R95.pin1" to="net.TEST2" />
      <trace from="U7.pin59" to="R95.pin2" />
      <trace from="U7.pin60" to="R97.pin2" />
      <trace from="U7.pin43" to="net.TIVA_D_N" />
      <trace from="U7.pin44" to="net.TIVA_D_P" />
      <trace from="C56.pin2" to="net.GND" />
      <trace from="C57.pin2" to="net.GND" />
      <trace from="C50.pin2" to="net.GND" />
      <trace from="C51.pin2" to="net.GND" />
      <trace from="C52.pin2" to="net.GND" />
      <trace from="C53.pin2" to="net.GND" />
      <trace from="C54.pin2" to="net.GND" />
      <trace from="C55.pin2" to="net.GND" />
      <trace from="C58.pin2" to="net.GND" />

      {/* Preserve additional TI net aliases through electrical connections. */}
      <schematictext
        text={"Figure 5-7. TIVA Schematic"}
        schX={0.34283}
        schY={-11.73011}
        fontSize={0.97847}
        anchor="center"
        schRotation={0}
      />
    </schematicsheet>
  )
}
