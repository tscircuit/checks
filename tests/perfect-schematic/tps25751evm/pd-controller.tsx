// TI SLVUCP9B, figure 5-4, page 41.
// TI layout with documented native-symbol spacing/alignment adjustments.
import { netSelector } from "./net-selector"

export function PdController() {
  return (
    <schematicsheet
      name="pd-controller"
      displayName="TPS25751 Controller"
      sheetIndex={4}
      sheetWidth={716.92}
      sheetHeight={498.32}
    >
      <resistor
        name="R49"
        schX={-8.47414}
        schY={4.45712}
        resistance="2.20kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW02012K20FKED"
      />
      <resistor
        name="R50"
        schX={-7.27417}
        schY={4.45712}
        resistance="2.20kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW02012K20FKED"
      />
      <resistor
        name="R52"
        schX={-4.87427}
        schY={4.45712}
        resistance="2.20kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW02012K20FKED"
      />
      <resistor
        name="R53"
        schX={-3.67433}
        schY={4.45712}
        resistance="2.20kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW02012K20FKED"
      />
      <resistor
        name="R48"
        schX={-9.67411}
        schY={4.45712}
        resistance="10.0kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW020110K0FKED"
      />
      <resistor
        name="R51"
        schX={-6.0742}
        schY={4.45712}
        resistance="10.0kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW020110K0FKED"
      />
      <connector
        name="J9"
        schX={-8.27412}
        schY={13.2604}
        pinLabels={{ pin1: "LDO_3V3", pin2: "LDO_3V3" }}
        schPinArrangement={{
          bottomSide: { pins: ["pin1", "pin2"], direction: "left-to-right" },
        }}
        schPinStyle={{
          pin1: { leftMargin: 0 },
          pin2: { leftMargin: 0.19997, rightMargin: 7e-5 },
        }}
        schWidth={1.19997}
        schHeight={1.215}
        pinAttributes={{ pin1: { isPassive: true }, pin2: { isPassive: true } }}
        manufacturerPartNumber="PBC02SAAN"
      />
      <connector
        name="J8"
        schX={-8.27412}
        schY={20.46309}
        pinLabels={{ pin1: "P3V3", pin2: "VIN_3V3" }}
        schPinArrangement={{
          bottomSide: { pins: ["pin1", "pin2"], direction: "left-to-right" },
        }}
        schPinStyle={{
          pin1: { leftMargin: 0 },
          pin2: { leftMargin: 0.19997, rightMargin: 7e-5 },
        }}
        schWidth={1.19997}
        schHeight={1.215}
        pinAttributes={{ pin1: { isPassive: true }, pin2: { isPassive: true } }}
        manufacturerPartNumber="PBC02SAAN"
      />
      <capacitor
        name="C31"
        schX={-9.27411}
        schY={-8.54774}
        capacitance="0.1uF"
        schRotation={270}
        manufacturerPartNumber="GMK105BJ104KV-F"
      />
      <resistor
        name="R79"
        schX={-5.27427}
        schY={-13.5496}
        resistance="10.0kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW020110K0FKED"
      />
      <resistor
        name="R78"
        schX={-6.47424}
        schY={-13.5496}
        resistance="10.0kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW020110K0FKED"
      />
      <resistor
        name="R82"
        schX={2.72549}
        schY={-13.94975}
        resistance="10.0kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW020110K0FKED"
      />
      <resistor
        name="R80"
        schX={-4.0743}
        schY={-13.5496}
        resistance="10.0kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW020110K0FKED"
      />
      {/* Lower the EEPROM header to clear the loose shunt pins while keeping the shunt below the section heading. */}
      <connector
        name="J10"
        schX={-1.87438}
        schY={-5.54632}
        pinLabels={{ pin1: "I2Cc_SDA_FLASH", pin2: "I2Cc_SDA" }}
        schPinArrangement={{
          bottomSide: { pins: ["pin1", "pin2"], direction: "left-to-right" },
        }}
        schPinStyle={{
          pin1: { leftMargin: 1e-5 },
          pin2: { leftMargin: 0.20003, rightMargin: 0 },
        }}
        schWidth={1.19997}
        schHeight={1.88}
        pinAttributes={{ pin1: { isPassive: true }, pin2: { isPassive: true } }}
        manufacturerPartNumber="PBC02SAAN"
      />
      <capacitor
        name="C28"
        schX={7.52533}
        schY={8.25854}
        capacitance="22uF"
        schRotation={270}
        manufacturerPartNumber="C2012X5R1V226M125AC"
      />
      <capacitor
        name="C29"
        schX={9.12527}
        schY={8.25854}
        capacitance="22uF"
        schRotation={270}
        manufacturerPartNumber="C2012X5R1V226M125AC"
      />
      <capacitor
        name="C30"
        schX={10.72521}
        schY={8.25854}
        capacitance="0.1uF"
        schRotation={270}
        manufacturerPartNumber="GMK105BJ104KV-F"
      />
      <chip
        name="U3"
        schX={-17.27383}
        schY={18.46234}
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
          pin4: { rightMargin: 6e-5 },
          pin5: { rightMargin: 0.19997 },
          pin6: { rightMargin: 0.20003, leftMargin: 0 },
          pin7: { leftMargin: 0 },
          pin3: { leftMargin: 0.19997 },
          pin2: { leftMargin: 0.20003 },
          pin1: { leftMargin: 0.19997, rightMargin: 0.40003 },
        }}
        schWidth={2.39994}
        schHeight={4.80213}
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
      <capacitor
        name="C21"
        schX={-20.07377}
        schY={20.66317}
        capacitance="0.01uF"
        schRotation={270}
        manufacturerPartNumber="C0402C103J5RACTU"
      />
      <capacitor
        name="C19"
        schX={-24.07361}
        schY={20.66317}
        capacitance="0.01uF"
        schRotation={270}
        manufacturerPartNumber="C0402C103J5RACTU"
      />
      <capacitor
        name="C20"
        schX={-22.07367}
        schY={20.66317}
        capacitance="0.01uF"
        schRotation={270}
        manufacturerPartNumber="C0402C103J5RACTU"
      />
      <capacitor
        name="C18"
        schX={-26.07355}
        schY={20.66317}
        capacitance="0.01uF"
        schRotation={270}
        manufacturerPartNumber="C0402C103J5RACTU"
      />
      {/* Align the native LED terminals with its series resistor. */}
      <led
        name="D9"
        schX={-28.07349}
        schY={20.46309}
        color="blue"
        pinLabels={{ pin1: ["cathode", "neg"], pin2: ["anode", "pos"] }}
        schRotation={270}
        manufacturerPartNumber="150060BS75000"
      />
      <resistor
        name="R40"
        schX={-28.07349}
        schY={18.06218}
        resistance="10.0kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW040210K0FKED"
      />
      {/* DNP option retained exactly where TI draws it. */}
      {/* Separate adjacent reference/value text while retaining the center of this resistor group. */}
      <resistor
        name="R42"
        schX={19.92493}
        schY={16.61182}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={180}
        doNotPlace
      />
      {/* DNP option retained exactly where TI draws it. */}
      {/* Separate adjacent reference/value text while retaining the center of this resistor group. */}
      <resistor
        name="R41"
        schX={19.92493}
        schY={17.51182}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={180}
        doNotPlace
      />
      {/* Separate adjacent reference/value text while retaining the center of this resistor group. */}
      <resistor
        name="R44"
        schX={19.92493}
        schY={15.11092}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={180}
        manufacturerPartNumber="CRCW04020000Z0ED"
      />
      {/* Separate adjacent reference/value text while retaining the center of this resistor group. */}
      <resistor
        name="R45"
        schX={19.92493}
        schY={14.21092}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={180}
        manufacturerPartNumber="CRCW04020000Z0ED"
      />
      {/* Leave clearance between the loose shunt pins and the header reference below it. */}
      <jumper
        name="SH-J3"
        schX={-8.27412}
        schY={22.86368}
        pinCount={2}
        pinLabels={{ pin1: "1", pin2: "2" }}
        schPinArrangement={{
          bottomSide: { pins: ["pin1", "pin2"], direction: "left-to-right" },
        }}
        schPinStyle={{
          pin1: { leftMargin: 0 },
          pin2: { leftMargin: 0.19997, rightMargin: 7e-5 },
        }}
        schWidth={1.19997}
        schHeight={0.40025}
        pinAttributes={{ pin1: { isPassive: true }, pin2: { isPassive: true } }}
        manufacturerPartNumber="SNT-100-BK-G"
      />
      {/* Leave clearance between the loose shunt pins and the header reference below it. */}
      <jumper
        name="SH-J4"
        schX={-8.27412}
        schY={15.661}
        pinCount={2}
        pinLabels={{ pin1: "1", pin2: "2" }}
        schPinArrangement={{
          bottomSide: { pins: ["pin1", "pin2"], direction: "left-to-right" },
        }}
        schPinStyle={{
          pin1: { leftMargin: 0 },
          pin2: { leftMargin: 0.19997, rightMargin: 7e-5 },
        }}
        schWidth={1.19997}
        schHeight={0.40025}
        pinAttributes={{ pin1: { isPassive: true }, pin2: { isPassive: true } }}
        manufacturerPartNumber="SNT-100-BK-G"
      />
      <testpoint
        name="TP14"
        schX={9.96523}
        schY={-11.54888}
        schRotation={180}
        manufacturerPartNumber="5015"
      />
      <testpoint
        name="TP13"
        schX={9.96523}
        schY={-10.74857}
        schRotation={180}
        manufacturerPartNumber="5015"
      />
      <testpoint
        name="TP12"
        schX={9.96523}
        schY={-9.94825}
        schRotation={180}
        manufacturerPartNumber="5015"
      />
      <testpoint
        name="TP11"
        schX={9.96523}
        schY={-9.14794}
        schRotation={180}
        manufacturerPartNumber="5015"
      />
      <testpoint
        name="TP10"
        schX={9.96523}
        schY={-8.34766}
        schRotation={180}
        manufacturerPartNumber="5015"
      />
      <testpoint
        name="TP9"
        schX={9.96523}
        schY={-7.54738}
        schRotation={180}
        manufacturerPartNumber="5015"
      />
      <testpoint
        name="TP8"
        schX={9.96523}
        schY={-6.74707}
        schRotation={180}
        manufacturerPartNumber="5015"
      />
      <testpoint
        name="TP7"
        schX={9.96523}
        schY={-5.94675}
        schRotation={180}
        manufacturerPartNumber="5015"
      />
      <testpoint
        name="TP6"
        schX={9.96523}
        schY={-5.14647}
        schRotation={180}
        manufacturerPartNumber="5015"
      />
      <testpoint
        name="TP4"
        schX={9.96523}
        schY={-3.54588}
        schRotation={180}
        manufacturerPartNumber="5015"
      />
      <testpoint
        name="TP16"
        schX={9.96523}
        schY={-13.14944}
        schRotation={180}
        manufacturerPartNumber="5015"
      />
      {/* DNP option retained exactly where TI draws it. */}
      <resistor
        name="R83"
        schX={23.1248}
        schY={-14.75003}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={0}
        doNotPlace
      />
      {/* DNP option retained exactly where TI draws it. */}
      <resistor
        name="R59"
        schX={23.1248}
        schY={-0.74482}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={0}
        doNotPlace
      />
      <resistor
        name="R77"
        schX={23.1248}
        schY={-12.74932}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={0}
        manufacturerPartNumber="CRCW02010000Z0ED"
      />
      <resistor
        name="R74"
        schX={23.1248}
        schY={-9.94825}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={0}
        manufacturerPartNumber="CRCW02010000Z0ED"
      />
      <resistor
        name="R61"
        schX={23.1248}
        schY={-2.74557}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={0}
        manufacturerPartNumber="CRCW02010000Z0ED"
      />
      <resistor
        name="R60"
        schX={23.1248}
        schY={-1.54513}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={0}
        manufacturerPartNumber="CRCW02010000Z0ED"
      />
      <resistor
        name="R84"
        schX={23.1248}
        schY={-15.55035}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={0}
        manufacturerPartNumber="CRCW02010000Z0ED"
      />
      <resistor
        name="R65"
        schX={23.1248}
        schY={-3.946}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={0}
        manufacturerPartNumber="CRCW02010000Z0ED"
      />
      <resistor
        name="R68"
        schX={23.1248}
        schY={-5.14647}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={0}
        manufacturerPartNumber="CRCW02010000Z0ED"
      />
      {/* DNP option retained exactly where TI draws it. */}
      <resistor
        name="R75"
        schX={23.1248}
        schY={-10.74857}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={0}
        doNotPlace
      />
      {/* DNP option retained exactly where TI draws it. */}
      <resistor
        name="R81"
        schX={23.1248}
        schY={-13.5496}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={0}
        doNotPlace
      />
      <resistor
        name="R72"
        schX={28.72461}
        schY={-9.54813}
        resistance="3.83kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW02013K83FKED"
      />
      <resistor
        name="R73"
        schX={30.32459}
        schY={-9.54813}
        resistance="3.83kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW02013K83FKED"
      />
      <capacitor
        name="C22"
        schX={-30.07343}
        schY={20.66317}
        capacitance="4.7uF"
        schRotation={270}
        manufacturerPartNumber="C2012X5R1H475K125AB"
      />
      <chip
        name="S1"
        schX={-24.87361}
        schY={1.77612}
        noSchematicRepresentation
        pinLabels={{
          pin6: "6",
          pin3: "3",
          pin1: "1",
          pin8: "8",
          pin2: "2",
          pin7: "7",
          pin5: "5",
          pin4: "4",
        }}
        schPinArrangement={{
          leftSide: {
            pins: ["pin1", "pin2", "pin3", "pin4"],
            direction: "top-to-bottom",
          },
          rightSide: {
            pins: ["pin5", "pin6", "pin7", "pin8"],
            direction: "bottom-to-top",
          },
        }}
        schPinStyle={{
          pin1: { topMargin: 0 },
          pin2: { topMargin: 0.20015 },
          pin3: { topMargin: 0.20016 },
          pin4: { topMargin: 0.20016, bottomMargin: 0.16003 },
          pin5: { bottomMargin: 0.16003 },
          pin6: { bottomMargin: 0.20016 },
          pin7: { bottomMargin: 0.20016 },
          pin8: { bottomMargin: 0.20015, topMargin: 0 },
        }}
        schWidth={1.59994}
        schHeight={1.52054}
        pinAttributes={{
          pin6: { isPassive: true },
          pin3: { isPassive: true },
          pin1: { isPassive: true },
          pin8: { isPassive: true },
          pin2: { isPassive: true },
          pin7: { isPassive: true },
          pin5: { isPassive: true },
          pin4: { isPassive: true },
        }}
        manufacturerPartNumber="TDA04H0SB1"
      />
      <schematicsymbol
        name="S1_1"
        displayName="S1.1"
        chipRef="chip.S1"
        symbolName="spst_switch"
        schX={-24.87361}
        schY={3.20637}
        connections={{ pin1: "chip.S1 > .pin1", pin2: "chip.S1 > .pin8" }}
      />
      <schematicsymbol
        name="S1_2"
        displayName="S1.2"
        chipRef="chip.S1"
        symbolName="spst_switch"
        schX={-24.87361}
        schY={2.30622}
        connections={{ pin1: "chip.S1 > .pin2", pin2: "chip.S1 > .pin7" }}
      />
      <schematicsymbol
        name="S1_3"
        displayName="S1.3"
        chipRef="chip.S1"
        symbolName="spst_switch"
        schX={-24.87361}
        schY={1.40606}
        connections={{ pin1: "chip.S1 > .pin3", pin2: "chip.S1 > .pin6" }}
      />
      <schematicsymbol
        name="S1_4"
        displayName="S1.4"
        chipRef="chip.S1"
        symbolName="spst_switch"
        schX={-24.87361}
        schY={0.5059}
        connections={{ pin1: "chip.S1 > .pin4", pin2: "chip.S1 > .pin5" }}
      />
      <chip
        name="S2"
        schX={-25.27358}
        schY={-3.82598}
        noSchematicRepresentation
        pinLabels={{
          pin6: "6",
          pin3: "3",
          pin1: "1",
          pin8: "8",
          pin2: "2",
          pin7: "7",
          pin5: "5",
          pin4: "4",
        }}
        schPinArrangement={{
          leftSide: {
            pins: ["pin1", "pin2", "pin3", "pin4"],
            direction: "top-to-bottom",
          },
          rightSide: {
            pins: ["pin5", "pin6", "pin7", "pin8"],
            direction: "bottom-to-top",
          },
        }}
        schPinStyle={{
          pin1: { topMargin: 0 },
          pin2: { topMargin: 0.20016 },
          pin3: { topMargin: 0.20016 },
          pin4: { topMargin: 0.20015, bottomMargin: 0.16011 },
          pin5: { bottomMargin: 0.16011 },
          pin6: { bottomMargin: 0.20015 },
          pin7: { bottomMargin: 0.20016 },
          pin8: { bottomMargin: 0.20016, topMargin: 0 },
        }}
        schWidth={1.59994}
        schHeight={1.52061}
        pinAttributes={{
          pin6: { isPassive: true },
          pin3: { isPassive: true },
          pin1: { isPassive: true },
          pin8: { isPassive: true },
          pin2: { isPassive: true },
          pin7: { isPassive: true },
          pin5: { isPassive: true },
          pin4: { isPassive: true },
        }}
        manufacturerPartNumber="TDA04H0SB1"
      />
      <schematicsymbol
        name="S2_1"
        displayName="S2.1"
        chipRef="chip.S2"
        symbolName="spst_switch"
        schX={-25.27358}
        schY={-2.39569}
        connections={{ pin1: "chip.S2 > .pin1", pin2: "chip.S2 > .pin8" }}
      />
      <schematicsymbol
        name="S2_2"
        displayName="S2.2"
        chipRef="chip.S2"
        symbolName="spst_switch"
        schX={-25.27358}
        schY={-3.29585}
        connections={{ pin1: "chip.S2 > .pin2", pin2: "chip.S2 > .pin7" }}
      />
      <schematicsymbol
        name="S2_3"
        displayName="S2.3"
        chipRef="chip.S2"
        symbolName="spst_switch"
        schX={-25.27358}
        schY={-4.19601}
        connections={{ pin1: "chip.S2 > .pin3", pin2: "chip.S2 > .pin6" }}
      />
      <schematicsymbol
        name="S2_4"
        displayName="S2.4"
        chipRef="chip.S2"
        symbolName="spst_switch"
        schX={-25.27358}
        schY={-5.09616}
        connections={{ pin1: "chip.S2 > .pin4", pin2: "chip.S2 > .pin5" }}
      />
      {/* Keep the surrounding divider branch clear of the expanded switch bank. */}
      <resistor
        name="R54"
        schX={-28.47349}
        schY={3.20637}
        resistance="499kohm"
        symbolName="resistor"
        schRotation={180}
        manufacturerPartNumber="CRCW0402499KFKED"
      />
      {/* Keep the surrounding divider branch clear of the expanded switch bank. */}
      <resistor
        name="R62"
        schX={-28.87346}
        schY={-2.39572}
        resistance="499kohm"
        symbolName="resistor"
        schRotation={180}
        manufacturerPartNumber="CRCW0402499KFKED"
      />
      {/* Keep the surrounding divider branch clear of the expanded switch bank. */}
      <resistor
        name="R67"
        schX={-25.27361}
        schY={-5.89647}
        resistance="40.2kohm"
        symbolName="resistor"
        schRotation={180}
        manufacturerPartNumber="CRCW040240K2FKED"
      />
      {/* DNP option retained exactly where TI draws it. */}
      {/* Keep the surrounding divider branch clear of the expanded switch bank. */}
      <resistor
        name="R58"
        schX={-24.87358}
        schY={-0.29438}
        resistance="40.2kohm"
        symbolName="resistor"
        schRotation={180}
        doNotPlace
      />
      {/* Keep the resistor aligned with its DIP-switch unit. */}
      <resistor
        name="R55"
        schX={-21.27374}
        schY={3.20637}
        resistance="59.0kohm"
        symbolName="resistor"
        schRotation={180}
        manufacturerPartNumber="CRCW040259K0FKED"
      />
      {/* Keep the resistor aligned with its DIP-switch unit. */}
      <resistor
        name="R56"
        schX={-21.27374}
        schY={2.30622}
        resistance="249kohm"
        symbolName="resistor"
        schRotation={180}
        manufacturerPartNumber="CRCW0402249KFKED"
      />
      {/* DNP option retained exactly where TI draws it. */}
      {/* Keep the resistor aligned with its DIP-switch unit. */}
      <resistor
        name="R57"
        schX={-21.27374}
        schY={1.40606}
        resistance="976kohm"
        symbolName="resistor"
        schRotation={180}
        doNotPlace
      />
      {/* Keep the resistor aligned with its DIP-switch unit. */}
      <resistor
        name="R63"
        schX={-21.6737}
        schY={-2.39572}
        resistance="59.0kohm"
        symbolName="resistor"
        schRotation={180}
        manufacturerPartNumber="CRCW040259K0FKED"
      />
      {/* Keep the resistor aligned with its DIP-switch unit. */}
      <resistor
        name="R64"
        schX={-21.6737}
        schY={-3.29585}
        resistance="249kohm"
        symbolName="resistor"
        schRotation={180}
        manufacturerPartNumber="CRCW0402249KFKED"
      />
      {/* Keep the resistor aligned with its DIP-switch unit. */}
      <resistor
        name="R66"
        schX={-21.6737}
        schY={-4.196}
        resistance="976kohm"
        symbolName="resistor"
        schRotation={180}
        manufacturerPartNumber="CRCW0402976KFKED"
      />
      <resistor
        name="R69"
        schX={23.1248}
        schY={-6.34691}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={0}
        manufacturerPartNumber="CRCW02010000Z0ED"
      />
      <resistor
        name="R70"
        schX={23.1248}
        schY={-7.54735}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={0}
        manufacturerPartNumber="CRCW02010000Z0ED"
      />
      <resistor
        name="R71"
        schX={23.1248}
        schY={-9.14797}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={0}
        manufacturerPartNumber="CRCW02010000Z0ED"
      />
      <resistor
        name="R76"
        schX={23.1248}
        schY={-11.949}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={0}
        manufacturerPartNumber="CRCW02010000Z0ED"
      />
      <testpoint
        name="TP15"
        schX={9.96523}
        schY={-12.34916}
        schRotation={180}
        manufacturerPartNumber="5015"
      />
      <jumper
        name="SH-J5"
        schX={-1.87438}
        schY={-3.14572}
        pinCount={2}
        pinLabels={{ pin1: "1", pin2: "2" }}
        schPinArrangement={{
          bottomSide: { pins: ["pin1", "pin2"], direction: "left-to-right" },
        }}
        schPinStyle={{
          pin1: { leftMargin: 1e-5 },
          pin2: { leftMargin: 0.20003, rightMargin: 0 },
        }}
        schWidth={1.19997}
        schHeight={0.40025}
        pinAttributes={{ pin1: { isPassive: true }, pin2: { isPassive: true } }}
        manufacturerPartNumber="SNT-100-BK-G"
      />
      <testpoint
        name="TP5"
        schX={9.96523}
        schY={-4.34616}
        schRotation={180}
        manufacturerPartNumber="5015"
      />
      {/* DNP option retained exactly where TI draws it. */}
      <resistor
        name="R47"
        schX={23.1248}
        schY={10.8595}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={270}
        doNotPlace
      />
      {/* DNP option retained exactly where TI draws it. */}
      <resistor
        name="R46"
        schX={23.1248}
        schY={14.06068}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={270}
        doNotPlace
      />
      <chip
        name="U4"
        schX={1.52552}
        schY={11.45973}
        pinLabels={{
          pin1: "LDO_3V3",
          pin38: "VIN_3V3",
          pin2: "ADCIN1",
          pin3: "ADCIN2",
          pin5: "GPIO0",
          pin6: "GPIO1",
          pin7: "GPIO2",
          pin19: "GPIO3",
          pin37: "GPIO6",
          pin36: "GPIO7",
          pin13: "GPIO11",
          pin15: "DRAIN",
          pin30: "DRAIN",
          pin40: "DRAIN_PAD",
          pin4: "LDO_1V5",
          pin34: "PP5V",
          pin20: "PPHV",
          pin32: "VBUS",
          pin23: "VBUS_IN",
          pin28: "CC1",
          pin29: "CC2",
          pin11: "GND",
          pin12: "GND",
          pin14: "GND",
          pin31: "GND",
          pin39: "GND_PAD",
          pin33: "VBUS",
          pin24: "VBUS_IN",
          pin25: "VBUS_IN",
          pin35: "PP5V",
          pin21: "PPHV",
          pin22: "PPHV",
          pin9: "I2Ct_SCL",
          pin8: "I2Ct_SDA",
          pin10: "I2Ct_IRQ",
          pin18: "I2Cc_IRQ",
          pin17: "I2Cc_SCL",
          pin16: "I2Cc_SDA",
          pin26: "GPIO4_USB_P_LD1",
          pin27: "GPIO5_USB_N_LD2",
        }}
        schPinArrangement={{
          leftSide: {
            pins: [
              "pin38",
              "pin32",
              "pin33",
              "pin23",
              "pin24",
              "pin25",
              "pin34",
              "pin35",
              "pin1",
              "pin4",
              "pin9",
              "pin8",
              "pin10",
              "pin17",
              "pin16",
              "pin18",
            ],
            direction: "top-to-bottom",
          },
          rightSide: {
            pins: [
              "pin39",
              "pin31",
              "pin14",
              "pin12",
              "pin11",
              "pin22",
              "pin21",
              "pin20",
              "pin29",
              "pin28",
              "pin3",
              "pin2",
              "pin40",
              "pin30",
              "pin15",
              "pin13",
              "pin36",
              "pin37",
              "pin27",
              "pin26",
              "pin19",
              "pin7",
              "pin6",
              "pin5",
            ],
            direction: "bottom-to-top",
          },
        }}
        schPinStyle={{
          pin38: { topMargin: 0.40015 },
          pin32: { topMargin: 0.60032 },
          pin33: { topMargin: 0.20016 },
          pin23: { topMargin: 0.60031 },
          pin24: { topMargin: 0.20009 },
          pin25: { topMargin: 0.20015 },
          pin34: { topMargin: 0.60032 },
          pin35: { topMargin: 0.20015 },
          pin1: { topMargin: 0.60032 },
          pin4: { topMargin: 0.20015 },
          pin9: { topMargin: 2.60104 },
          pin8: { topMargin: 0.20015 },
          pin10: { topMargin: 0.20016 },
          pin17: { topMargin: 1.40056 },
          pin16: { topMargin: 0.20015 },
          pin18: { topMargin: 0.20016, bottomMargin: 0 },
          pin39: { bottomMargin: 0 },
          pin31: { bottomMargin: 0.20016 },
          pin14: { bottomMargin: 0.20015 },
          pin12: { bottomMargin: 0.20016 },
          pin11: { bottomMargin: 0.20015 },
          pin22: { bottomMargin: 0.60025 },
          pin21: { bottomMargin: 0.20016 },
          pin20: { bottomMargin: 0.20015 },
          pin29: { bottomMargin: 0.60032 },
          pin28: { bottomMargin: 0.20015 },
          pin3: { bottomMargin: 0.60032 },
          pin2: { bottomMargin: 0.20015 },
          pin40: { bottomMargin: 0.60025 },
          pin30: { bottomMargin: 0.20016 },
          pin15: { bottomMargin: 0.20016 },
          pin13: { bottomMargin: 0.60031 },
          pin36: { bottomMargin: 0.20016 },
          pin37: { bottomMargin: 0.20015 },
          pin27: { bottomMargin: 0.20009 },
          pin26: { bottomMargin: 0.20016 },
          pin19: { bottomMargin: 0.20015 },
          pin7: { bottomMargin: 0.20016 },
          pin6: { bottomMargin: 0.20016 },
          pin5: { bottomMargin: 0.20016, topMargin: 0.40015 },
        }}
        schWidth={7.99969}
        schHeight={12.40466}
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
          pin5: { isBidirectional: true, isGpio: true },
          pin6: { isBidirectional: true, isGpio: true },
          pin7: { isBidirectional: true, isGpio: true },
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
          pin13: { isBidirectional: true, isGpio: true },
          pin14: { requiresGround: true },
          pin15: { isPassive: true },
          pin16: {
            isBidirectional: true,
            canUseOpenDrain: true,
            isUsingOpenDrain: true,
            capabilities: ["i2c_sda"],
          },
          pin17: {
            isOutput: true,
            canUseOpenDrain: true,
            isUsingOpenDrain: true,
            capabilities: ["i2c_scl"],
          },
          pin18: { isInput: true },
          pin19: { isBidirectional: true, isGpio: true },
          pin20: {
            isBidirectional: true,
            requiresPower: true,
            providesPower: true,
          },
          pin21: {
            isBidirectional: true,
            requiresPower: true,
            providesPower: true,
          },
          pin22: {
            isBidirectional: true,
            requiresPower: true,
            providesPower: true,
          },
          pin23: {
            isBidirectional: true,
            requiresPower: true,
            providesPower: true,
          },
          pin24: {
            isBidirectional: true,
            requiresPower: true,
            providesPower: true,
          },
          pin25: {
            isBidirectional: true,
            requiresPower: true,
            providesPower: true,
          },
          pin26: { isBidirectional: true, isGpio: true },
          pin27: { isBidirectional: true, isGpio: true },
          pin28: { isBidirectional: true },
          pin29: { isBidirectional: true },
          pin30: { isPassive: true },
          pin31: { requiresGround: true },
          pin32: {
            isBidirectional: true,
            requiresPower: true,
            providesPower: true,
          },
          pin33: {
            isBidirectional: true,
            requiresPower: true,
            providesPower: true,
          },
          pin34: { requiresPower: true },
          pin35: { requiresPower: true },
          pin36: { isBidirectional: true, isGpio: true },
          pin37: { isBidirectional: true, isGpio: true },
          pin38: { requiresPower: true, shouldHaveDecouplingCapacitor: true },
          pin39: { requiresGround: true },
          pin40: { isPassive: true },
        }}
        manufacturerPartNumber="TPS25751DREFR"
      />
      <resistor
        name="R43"
        schX={8.7253}
        schY={16.06143}
        resistance="0ohm"
        symbolName="resistor"
        schRotation={180}
        manufacturerPartNumber="CRCW04020000Z0ED"
      />
      <chip
        name="U5"
        schX={-0.07442}
        schY={-11.14872}
        pinLabels={{
          pin1: "A0",
          pin2: "A1",
          pin3: "A2",
          pin4: "VSS",
          pin5: "SDA",
          pin6: "SCL",
          pin7: "WP",
          pin8: "VCC",
        }}
        schPinArrangement={{
          leftSide: {
            pins: ["pin1", "pin2", "pin3", "pin4"],
            direction: "top-to-bottom",
          },
          rightSide: {
            pins: ["pin5", "pin6", "pin7", "pin8"],
            direction: "bottom-to-top",
          },
        }}
        schPinStyle={{
          pin1: { topMargin: 0 },
          pin2: { topMargin: 0.60025 },
          pin3: { topMargin: 0.60031 },
          pin4: { topMargin: 0.60032, bottomMargin: 0 },
          pin5: { bottomMargin: 0 },
          pin6: { bottomMargin: 0.60032 },
          pin7: { bottomMargin: 0.60031 },
          pin8: { bottomMargin: 0.60025, topMargin: 0 },
        }}
        schWidth={3.99988}
        schHeight={3.20119}
        pinAttributes={{
          pin1: { isInput: true },
          pin2: { isInput: true },
          pin3: { isInput: true },
          pin4: { requiresGround: true },
          pin5: {
            isBidirectional: true,
            canUseOpenDrain: true,
            isUsingOpenDrain: true,
            capabilities: ["i2c_sda"],
          },
          pin6: { isInput: true, capabilities: ["i2c_scl"] },
          pin7: { isInput: true },
          pin8: { requiresPower: true, shouldHaveDecouplingCapacitor: true },
        }}
        manufacturerPartNumber="CAT24C256WI-GT3"
      />
      <capacitor
        name="C27"
        schX={15.52505}
        schY={8.65867}
        capacitance="220pF"
        schRotation={270}
        manufacturerPartNumber="CGA1A2X7R1H221K030BA"
      />
      <capacitor
        name="C26"
        schX={13.92511}
        schY={8.65867}
        capacitance="220pF"
        schRotation={270}
        manufacturerPartNumber="CGA1A2X7R1H221K030BA"
      />
      <capacitor
        name="C23"
        schX={-6.07424}
        schY={18.66242}
        capacitance="10uF"
        schRotation={90}
        manufacturerPartNumber="CC0402MRX5R6BB106"
      />
      <capacitor
        name="C25"
        schX={-4.47427}
        schY={11.05957}
        capacitance="10uF"
        schRotation={90}
        manufacturerPartNumber="CC0402MRX5R6BB106"
      />
      <capacitor
        name="C24"
        schX={-6.4742}
        schY={11.05957}
        capacitance="10uF"
        schRotation={90}
        manufacturerPartNumber="CC0402MRX5R6BB106"
      />

      {/* Electrical connections transcribed from TI, including labeled nets. */}
      <trace from="S2.pin3" to="net.ADCIN2" />
      <trace from="S2.pin1" to="net.ADCIN2" />
      <trace from="S2.pin2" to="net.ADCIN2" />
      <trace from="S2.pin4" to="net.ADCIN2" />
      <trace from="R62.pin1" to="net.ADCIN2" />
      <trace from="C27.pin2" to="net.GND" />
      <trace from="C26.pin2" to="net.GND" />
      <trace from="R53.pin1" to="net.I2Ct_SCL" />
      <trace from="U4.pin9" to="net.I2Ct_SCL" />
      <trace from="R52.pin1" to="net.I2Ct_SDA" />
      <trace from="U4.pin8" to="net.I2Ct_SDA" />
      <trace from="R51.pin1" to="net.I2Ct_IRQ" />
      <trace from="U4.pin10" to="net.I2Ct_IRQ" />
      <trace from="R50.pin1" to="net.I2Cc_SCL" />
      <trace from="U4.pin17" to="net.I2Cc_SCL" />
      <trace from="R49.pin1" to="net.I2Cc_SDA" />
      <trace from="U4.pin16" to="net.I2Cc_SDA" />
      <trace from="R48.pin1" to="net.I2Cc_IRQ" />
      <trace from="U4.pin18" to="net.I2Cc_IRQ" />
      <trace from="R49.pin2" to="net.LDO_3V3" />
      <trace from="R50.pin2" to="net.LDO_3V3" />
      <trace from="R52.pin2" to="net.LDO_3V3" />
      <trace from="R53.pin2" to="net.LDO_3V3" />
      <trace from="R48.pin2" to="net.LDO_3V3" />
      <trace from="R51.pin2" to="net.LDO_3V3" />
      <trace from="U4.pin11" to="net.GND" />
      <trace from="U4.pin12" to="net.GND" />
      <trace from="U4.pin14" to="net.GND" />
      <trace from="U4.pin31" to="net.GND" />
      <trace from="U4.pin39" to="net.GND" />
      <trace from="J9.pin1" to="net.LDO_3V3" />
      <trace from="U4.pin32" to={netSelector("751_VBUS")} />
      <trace from="U4.pin23" to={netSelector("751_VBUS")} />
      <trace from="U4.pin33" to={netSelector("751_VBUS")} />
      <trace from="U4.pin24" to={netSelector("751_VBUS")} />
      <trace from="U4.pin25" to={netSelector("751_VBUS")} />
      <trace from="U4.pin34" to="net.PP5V" />
      <trace from="U4.pin35" to="net.PP5V" />
      <trace from="J8.pin1" to="net.P3V3" />
      <trace from="U4.pin15" to={netSelector("751_DRAIN")} />
      <trace from="U4.pin30" to={netSelector("751_DRAIN")} />
      <trace from="U4.pin40" to={netSelector("751_DRAIN")} />
      <trace from="U4.pin5" to="net.GPIO0" />
      <trace from="U4.pin6" to="net.GPIO1" />
      <trace from="U4.pin37" to="net.GPIO6" />
      <trace from="U4.pin36" to="net.GPIO7" />
      <trace from="U4.pin13" to="net.GPIO11" />
      <trace from="U4.pin2" to="net.ADCIN1" />
      <trace from="U4.pin3" to="net.ADCIN2" />
      <trace from="C31.pin1" to="net.LDO_3V3" />
      <trace from="U5.pin8" to="net.LDO_3V3" />
      <trace from="J10.pin1" to="net.I2Cc_SDA_FLASH" />
      <trace from="J10.pin2" to="net.I2Cc_SDA" />
      <trace from="J9.pin2" to="U4.pin1" />
      <trace from="J9.pin2" to="C25.pin2" />
      <trace from="C28.pin1" to={netSelector("751_PPHV")} />
      <trace from="C29.pin1" to={netSelector("751_PPHV")} />
      <trace from="C30.pin1" to={netSelector("751_PPHV")} />
      <trace from="U4.pin20" to={netSelector("751_PPHV")} />
      <trace from="U4.pin21" to={netSelector("751_PPHV")} />
      <trace from="U4.pin22" to={netSelector("751_PPHV")} />
      <trace from="C28.pin2" to="net.GND" />
      <trace from="C29.pin2" to="net.GND" />
      <trace from="C30.pin2" to="net.GND" />
      <trace from="U3.pin1" to="net.GND" />
      <trace from="U3.pin2" to="net.GND" />
      <trace from="U3.pin3" to="net.GND" />
      <trace from="U3.pin7" to="net.GND" />
      <trace from="C21.pin2" to="net.GND" />
      <trace from="C19.pin2" to="net.GND" />
      <trace from="C20.pin2" to="net.GND" />
      <trace from="C18.pin2" to="net.GND" />
      <trace from="R40.pin2" to="net.GND" />
      <trace from="C22.pin2" to="net.GND" />
      <trace from="D9.pin1" to="R40.pin1" />
      <trace from="U3.pin4" to={netSelector("751_VBUS")} />
      <trace from="U3.pin5" to={netSelector("751_VBUS")} />
      <trace from="U3.pin6" to={netSelector("751_VBUS")} />
      <trace from="C21.pin1" to={netSelector("751_VBUS")} />
      <trace from="C19.pin1" to={netSelector("751_VBUS")} />
      <trace from="C20.pin1" to={netSelector("751_VBUS")} />
      <trace from="C18.pin1" to={netSelector("751_VBUS")} />
      <trace from="D9.pin2" to={netSelector("751_VBUS")} />
      <trace from="C22.pin1" to={netSelector("751_VBUS")} />
      <trace from="R41.pin2" to="net.GPIO_45P" />
      <trace from="R44.pin2" to="net.GPIO_45P" />
      <trace from="U4.pin26" to="net.GPIO_45P" />
      <trace from="R42.pin2" to="net.GPIO_45N" />
      <trace from="R45.pin2" to="net.GPIO_45N" />
      <trace from="U4.pin27" to="net.GPIO_45N" />
      <trace from="TP13.pin1" to="net.VBAT" />
      <trace from="TP14.pin1" to="net.GND" />
      <trace from="TP6.pin1" to="net.LDO_3V3" />
      <trace from="TP7.pin1" to="net.LDO_1V5" />
      <trace from="TP8.pin1" to={netSelector("751_VBUS")} />
      <trace from="TP9.pin1" to={netSelector("751_PPHV")} />
      <trace from="TP10.pin1" to="net.PP5V" />
      <trace from="TP11.pin1" to={netSelector("751_C_CC1")} />
      <trace from="TP12.pin1" to={netSelector("751_C_CC2")} />
      <trace from="TP15.pin1" to={netSelector("751_C_SBU2")} />
      <trace from="TP16.pin1" to={netSelector("751_C_SBU1")} />
      <trace from="R59.pin2" to="net.BQ_PG" />
      <trace from="R83.pin2" to="net.BQ_INT" />
      <trace from="R74.pin2" to="net.GPIO_NF" />
      <trace from="R77.pin2" to="net.GPIO_PF" />
      <trace from="R61.pin2" to="net.A_GPIO1" />
      <trace from="R83.pin1" to="net.GPIO11" />
      <trace from="R84.pin1" to="net.GPIO11" />
      <trace from="R59.pin1" to="net.GPIO0" />
      <trace from="R60.pin1" to="net.GPIO0" />
      <trace from="R60.pin2" to="net.A_GPIO0" />
      <trace from="R68.pin2" to="net.A_GPIO3" />
      <trace from="R84.pin2" to="net.A_GPIO11" />
      <trace from="R74.pin1" to="net.GPIO6" />
      <trace from="R75.pin1" to="net.GPIO6" />
      <trace from="R71.pin1" to="net.GPIO6" />
      <trace from="R77.pin1" to="net.GPIO7" />
      <trace from="R81.pin1" to="net.GPIO7" />
      <trace from="R76.pin1" to="net.GPIO7" />
      <trace from="R81.pin2" to="net.TEST2" />
      <trace from="R73.pin2" to="net.TEST2" />
      <trace from="S1.pin3" to="net.ADCIN1" />
      <trace from="S1.pin1" to="net.ADCIN1" />
      <trace from="S1.pin2" to="net.ADCIN1" />
      <trace from="S1.pin4" to="net.ADCIN1" />
      <trace from="R54.pin1" to="net.ADCIN1" />
      <trace from="R54.pin2" to="net.GND" />
      <trace from="R58.pin2" to="net.GND" />
      <trace from="S1.pin5" to="R58.pin1" />
      <trace from="S1.pin6" to="R57.pin2" />
      <trace from="S1.pin7" to="R56.pin2" />
      <trace from="S1.pin8" to="R55.pin2" />
      <trace from="R55.pin1" to="net.LDO_3V3" />
      <trace from="R56.pin1" to="net.LDO_3V3" />
      <trace from="R57.pin1" to="net.LDO_3V3" />
      <trace from="R62.pin2" to="net.GND" />
      <trace from="R67.pin2" to="net.GND" />
      <trace from="S2.pin8" to="R63.pin2" />
      <trace from="S2.pin7" to="R64.pin2" />
      <trace from="S2.pin6" to="R66.pin2" />
      <trace from="S2.pin5" to="R67.pin1" />
      <trace from="R63.pin1" to="net.LDO_3V3" />
      <trace from="R64.pin1" to="net.LDO_3V3" />
      <trace from="R66.pin1" to="net.LDO_3V3" />
      <trace from="R79.pin2" to="net.GND" />
      <trace from="R78.pin2" to="net.GND" />
      <trace from="R82.pin2" to="net.GND" />
      <trace from="R80.pin2" to="net.GND" />
      <trace from="U5.pin4" to="net.GND" />
      <trace from="U4.pin29" to={netSelector("751_CC2")} />
      <trace from="C26.pin1" to={netSelector("751_CC2")} />
      <trace from="U4.pin28" to={netSelector("751_CC1")} />
      <trace from="C27.pin1" to={netSelector("751_CC1")} />
      <trace from="R45.pin1" to="net.LD2" />
      <trace from="R47.pin1" to="net.LD2" />
      <trace from="R61.pin1" to="net.GPIO1" />
      <trace from="R69.pin1" to="net.GPIO_45P" />
      <trace from="R70.pin1" to="net.GPIO_45N" />
      <trace from="R75.pin2" to="net.TEST1" />
      <trace from="R72.pin2" to="net.TEST1" />
      <trace from="R72.pin1" to="net.LDO_3V3" />
      <trace from="R73.pin1" to="net.LDO_3V3" />
      <trace from="R71.pin2" to="net.A_GPIO6" />
      <trace from="R69.pin2" to="net.A_GPIO4" />
      <trace from="R70.pin2" to="net.A_GPIO5" />
      <trace from="R76.pin2" to="net.A_GPIO7" />
      <trace from="TP5.pin1" to="net.P3V3" />
      <trace from="TP4.pin1" to="net.GND" />
      <trace from="R68.pin1" to="net.GPIO3" />
      <trace from="R65.pin1" to="net.GPIO2" />
      <trace from="R65.pin2" to="net.A_GPIO2" />
      <trace from="R44.pin1" to="net.LD1" />
      <trace from="R46.pin2" to="net.LD1" />
      <trace from="R46.pin1" to={netSelector("751_C_SBU1")} />
      <trace from="R80.pin1" to="U5.pin3" />
      <trace from="R79.pin1" to="U5.pin2" />
      <trace from="R78.pin1" to="U5.pin1" />
      <trace from="R82.pin1" to="U5.pin7" />
      <trace from="U5.pin6" to="net.I2Cc_SCL" />
      <trace from="U5.pin5" to="net.I2Cc_SDA_FLASH" />
      <trace from="U4.pin7" to="net.GPIO2" />
      <trace from="R43.pin2" to="net.GPIO2" />
      <trace from="R43.pin1" to="net.TPD_FLT" />
      <trace from="R47.pin2" to={netSelector("751_C_SBU2")} />
      <trace from="U4.pin19" to="net.GPIO3" />
      <trace from="J8.pin2" to="U4.pin38" />
      <trace from="J8.pin2" to="C23.pin2" />
      <trace from="U4.pin4" to="net.LDO_1V5" />
      <trace from="C24.pin2" to="net.LDO_1V5" />
      <trace from="R41.pin1" to={netSelector("751_D_P")} />
      <trace from="R42.pin1" to={netSelector("751_D_N")} />
      <trace from="C31.pin2" to="net.GND" />
      <trace from="C23.pin1" to="net.GND" />
      <trace from="C25.pin1" to="net.GND" />
      <trace from="C24.pin1" to="net.GND" />

      {/* Preserve additional TI net aliases through electrical connections. */}
      <trace from="U4.pin19" to="net.TPD_VPWR" />

      {/* TI section outlines and configuration-table borders. */}
      <schematicbox
        schX={19.72491}
        schY={15.86139}
        width={5.99978}
        height={4.40166}
      />
      <schematicbox schX={19.92493} schY={17.06182} width={2.8} height={1.8} />
      <schematicbox schX={19.92493} schY={14.66092} width={2.8} height={1.8} />
      <schematicbox
        schX={12.12516}
        schY={-9.14797}
        width={9.99965}
        height={14.40538}
      />
      <schematicbox
        schX={-22.07367}
        schY={-6.14686}
        width={18.39938}
        height={21.20791}
      />
      <schematicbox
        schX={-3.07431}
        schY={-9.34805}
        width={17.19941}
        height={14.80553}
      />
      <schematicbox
        schX={25.72469}
        schY={-8.14758}
        width={13.99953}
        height={16.40616}
      />
      <schematicline x1={-30.8734} y1={-6.74703} x2={-13.27395} y2={-6.74703} />
      <schematicline
        x1={-23.27368}
        y1={-7.54735}
        x2={-23.27368}
        y2={-16.35066}
      />
      <schematicline x1={-23.27368} y1={-7.54735} x2={-30.8734} y2={-7.54735} />
      <schematicline
        x1={-23.27368}
        y1={-7.54735}
        x2={-13.27395}
        y2={-7.54735}
      />
      <schematicline x1={-30.8734} y1={-9.14797} x2={-13.27395} y2={-9.14797} />
      <schematicline x1={-30.8734} y1={-8.34766} x2={-13.27395} y2={-8.34766} />
      <schematicline
        x1={-23.27368}
        y1={-14.75004}
        x2={-13.27395}
        y2={-14.75004}
      />
      <schematicline
        x1={-13.27395}
        y1={-6.74703}
        x2={-13.27395}
        y2={-16.35066}
      />
      <schematicline
        x1={-13.27395}
        y1={-16.35066}
        x2={-30.8734}
        y2={-16.35066}
      />
      <schematicline x1={-30.8734} y1={-6.74703} x2={-30.8734} y2={-16.35066} />
      <schematictext
        text={"Liquid Detection/BC1.2 Selection"}
        schX={19.41142}
        schY={20.6703}
        fontSize={1.16102}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"Please note - 0ohm resistors can only be placed in the "}
        schX={20.70955}
        schY={19.85264}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"following configurations:"}
        schX={18.22998}
        schY={19.45255}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"For BC1.2: R41 & R42 Placed (default not populated)"}
        schX={20.53535}
        schY={19.05239}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"For Liquid Detection: R44 & R45 Placed (default populated)"}
        schX={21.02916}
        schY={18.65224}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"Zero Ohm Name Change"}
        schX={25.35415}
        schY={0.66287}
        fontSize={1.16102}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"Test Points"}
        schX={11.67358}
        schY={-1.33785}
        fontSize={1.16102}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"ADCIN DIVIDER SWITCHES"}
        schX={-22.27949}
        schY={5.06453}
        fontSize={1.16102}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"CONFIGURATION EEPROM"}
        schX={-3.68679}
        schY={-1.33785}
        fontSize={1.16102}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"Remove jumper to disable I2C flash boot"}
        schX={-7}
        schY={-5.54632}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"ADCINx Switches"}
        schX={-26.88881}
        schY={-7.95772}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"1:"}
        schX={-30.46321}
        schY={-8.75803}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"2:"}
        schX={-29.2633}
        schY={-8.75803}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"Decoded Value"}
        schX={-24.8925}
        schY={-8.75803}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"ADCIN1"}
        schX={-22.05629}
        schY={-8.75803}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"Configuration Truth Tables"}
        schX={-23.31885}
        schY={-7.1574}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"3:"}
        schX={-28.06334}
        schY={-8.75803}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"4:"}
        schX={-26.86337}
        schY={-8.75803}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"0"}
        schX={-30.4765}
        schY={-9.55834}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"1"}
        schX={-26.85002}
        schY={-10.35859}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"1"}
        schX={-28.04992}
        schY={-10.35859}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"1"}
        schX={-26.85002}
        schY={-11.1589}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"1"}
        schX={-29.24989}
        schY={-11.1589}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"0"}
        schX={-29.2766}
        schY={-9.55834}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"0"}
        schX={-28.07663}
        schY={-9.55834}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"0"}
        schX={-26.87666}
        schY={-9.55834}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"0"}
        schX={-30.4765}
        schY={-10.35859}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"0"}
        schX={-29.2766}
        schY={-10.35859}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"0"}
        schX={-30.4765}
        schY={-11.1589}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"0"}
        schX={-28.07663}
        schY={-11.1589}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"0"}
        schX={-30.4765}
        schY={-11.95922}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"0"}
        schX={-30.4765}
        schY={-12.75953}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"0"}
        schX={-30.4765}
        schY={-13.55978}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"1"}
        schX={-29.24989}
        schY={-11.95922}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"1"}
        schX={-28.04992}
        schY={-11.95922}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"1"}
        schX={-26.85002}
        schY={-11.95922}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"1"}
        schX={-28.04992}
        schY={-12.75953}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"1"}
        schX={-29.24989}
        schY={-13.55978}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"1"}
        schX={-30.44986}
        schY={-14.36009}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"1"}
        schX={-30.44986}
        schY={-15.1604}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"1"}
        schX={-29.24989}
        schY={-15.1604}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"0"}
        schX={-29.2766}
        schY={-12.75953}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"0"}
        schX={-26.87666}
        schY={-12.75953}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"0"}
        schX={-28.07663}
        schY={-13.55978}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"0"}
        schX={-26.87666}
        schY={-13.55978}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"0"}
        schX={-29.2766}
        schY={-14.36009}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"0"}
        schX={-28.07663}
        schY={-14.36009}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"0"}
        schX={-26.87666}
        schY={-14.36009}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"0"}
        schX={-28.07663}
        schY={-15.1604}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"0"}
        schX={-26.87666}
        schY={-15.1604}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"0"}
        schX={-24.87669}
        schY={-9.55834}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"1"}
        schX={-24.85005}
        schY={-10.35859}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"2"}
        schX={-24.87669}
        schY={-11.1589}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"3"}
        schX={-24.87669}
        schY={-11.95922}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"4"}
        schX={-24.87669}
        schY={-12.75953}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"5"}
        schX={-24.87669}
        schY={-13.55978}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"6"}
        schX={-24.87669}
        schY={-14.36009}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"7"}
        schX={-24.87669}
        schY={-15.1604}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"ADCIN2"}
        schX={-20.08303}
        schY={-8.75803}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"I2C Add."}
        schX={-18.07229}
        schY={-8.75803}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"Dead Batt"}
        schX={-16.08305}
        schY={-8.75803}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"7"}
        schX={-22.07678}
        schY={-9.55834}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"5"}
        schX={-20.07688}
        schY={-9.55834}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"5"}
        schX={-22.07678}
        schY={-10.35859}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"5"}
        schX={-20.07688}
        schY={-10.35859}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"7"}
        schX={-22.07678}
        schY={-11.1589}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"3"}
        schX={-20.07688}
        schY={-11.1589}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"3"}
        schX={-22.07678}
        schY={-11.95922}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"3"}
        schX={-20.07688}
        schY={-11.95922}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"7"}
        schX={-22.07678}
        schY={-12.75953}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"0"}
        schX={-20.07688}
        schY={-12.75953}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"0"}
        schX={-22.07678}
        schY={-13.55978}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"0"}
        schX={-20.07688}
        schY={-13.55978}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"#1"}
        schX={-18.04362}
        schY={-9.55834}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"#1"}
        schX={-18.04362}
        schY={-11.1589}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"#1"}
        schX={-18.04362}
        schY={-12.75953}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"#2"}
        schX={-18.07026}
        schY={-10.35859}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"#2"}
        schX={-18.07026}
        schY={-11.95922}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"#2"}
        schX={-18.07026}
        schY={-13.55978}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"AlwaysEnableSink"}
        schX={-15.26921}
        schY={-9.55834}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"AlwaysEnableSink"}
        schX={-15.26921}
        schY={-10.35859}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"NegotiateHighVoltage"}
        schX={-15.29235}
        schY={-11.1589}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"NegotiateHighVoltage"}
        schX={-15.29235}
        schY={-11.95922}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"SafeMode"}
        schX={-15.29314}
        schY={-12.75953}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"SafeMode"}
        schX={-15.29314}
        schY={-13.55978}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"Device Configuration"}
        schX={-18.47563}
        schY={-7.95772}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"I2C Address #1:"}
        schX={-19.68024}
        schY={-15.1604}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"All Else:"}
        schX={-20.85478}
        schY={-14.36009}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"DO NOT USE"}
        schX={-16.88286}
        schY={-14.36009}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"I2C Address #2:"}
        schX={-19.68024}
        schY={-15.96072}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"0x20"}
        schX={-17.27013}
        schY={-15.1604}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"0x21"}
        schX={-17.25684}
        schY={-15.96072}
        fontSize={0.3603}
        anchor="center"
        schRotation={0}
      />
      <schematictext
        text={"Figure 5-4. TPS25751 Schematic"}
        schX={0.35084}
        schY={-21.3941}
        fontSize={1.00276}
        anchor="center"
        schRotation={0}
      />
    </schematicsheet>
  )
}
