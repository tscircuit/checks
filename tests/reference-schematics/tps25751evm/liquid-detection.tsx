// TI SLVUCP9B, figure 5-6, page 43.
// TI layout with documented native-symbol spacing/alignment adjustments.
import { netSelector } from "./net-selector"

export function LiquidDetection() {
  return (
    <schematicsheet
      name="liquid-detection"
      displayName="Liquid Detection"
      sheetIndex={6}
      sheetWidth={432.46}
      sheetHeight={218.81}
    >
      <mosfet
        name="QN1"
        schX={-11.00447}
        schY={-4.93324}
        mosfetMode="enhancement"
        channelType="n"
        symbolGateSide="left"
        symbolSourceSide="bottom"
        symbolDrainSide="top"
        manufacturerPartNumber="CSD15380F3"
      />
      <mosfet
        name="QN2"
        schX={12.98949}
        schY={-4.93367}
        mosfetMode="enhancement"
        channelType="n"
        symbolGateSide="left"
        symbolSourceSide="bottom"
        symbolDrainSide="top"
        manufacturerPartNumber="CSD15380F3"
      />
      <mosfet
        name="QP1"
        schX={-11.00447}
        schY={2.25183}
        mosfetMode="enhancement"
        channelType="p"
        symbolGateSide="left"
        symbolSourceSide="top"
        symbolDrainSide="bottom"
        manufacturerPartNumber="CSD25480F3"
      />
      <mosfet
        name="QP2"
        schX={12.98949}
        schY={2.25098}
        mosfetMode="enhancement"
        channelType="p"
        symbolGateSide="left"
        symbolSourceSide="top"
        symbolDrainSide="bottom"
        manufacturerPartNumber="CSD25480F3"
      />
      {/* Align the resistor terminals with the native upper and lower MOSFET drain terminals. */}
      <resistor
        name="R107"
        schX={13.28949}
        schY={0.05569}
        resistance="249kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW0402249KFKED"
      />
      {/* Align the resistor terminals with the native upper and lower MOSFET drain terminals. */}
      <resistor
        name="R106"
        schX={-10.70447}
        schY={0.05651}
        resistance="249kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW0402249KFKED"
      />
      {/* Align the resistor terminals with the native upper and lower MOSFET drain terminals. */}
      <resistor
        name="R108"
        schX={-10.70447}
        schY={-2.33838}
        resistance="1.00Megohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW04021M00FKED"
      />
      {/* Align the resistor terminals with the native upper and lower MOSFET drain terminals. */}
      <resistor
        name="R109"
        schX={13.28949}
        schY={-2.3392}
        resistance="1.00Megohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="CRCW04021M00FKED"
      />
      <resistor
        name="R105"
        schX={-12.66434}
        schY={3.64884}
        resistance="100kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="RC1005F104CS"
      />
      <resistor
        name="R110"
        schX={-12.66434}
        schY={-6.33067}
        resistance="100kohm"
        symbolName="resistor"
        schRotation={270}
        manufacturerPartNumber="RC1005F104CS"
      />

      {/* Electrical connections transcribed from TI, including labeled nets. */}
      <trace from="QP1.gate" to="net.GPIO_PF" />
      <trace from="R105.pin2" to="net.GPIO_PF" />
      <trace from="QP2.gate" to="net.GPIO_PF" />
      <trace from="QN1.gate" to="net.GPIO_NF" />
      <trace from="R110.pin1" to="net.GPIO_NF" />
      <trace from="QN2.gate" to="net.GPIO_NF" />
      <trace from="R107.pin2" to="net.LD2" />
      <trace from="R109.pin1" to="net.LD2" />
      <trace from="R106.pin2" to="net.LD1" />
      <trace from="R108.pin1" to="net.LD1" />
      <trace from="QN1.drain" to="R108.pin2" />
      <trace from="QN2.drain" to="R109.pin2" />
      <trace from="QP1.source" to="net.LDO_3V3" />
      <trace from="QP2.source" to="net.LDO_3V3" />
      <trace from="R105.pin1" to="net.LDO_3V3" />
      <trace from="QN1.source" to="net.GND" />
      <trace from="R110.pin2" to="net.GND" />
      <trace from="QN2.source" to="net.GND" />
      <trace from="QP1.drain" to="R106.pin1" />
      <trace from="QP2.drain" to="R107.pin1" />

      {/* Preserve additional TI net aliases through electrical connections. */}
      <schematictext
        text={"Liquid Detection"}
        schX={0.46251}
        schY={7.85506}
        fontSize={1.15992}
        anchor="center"
        schRotation={0}
      />
    </schematicsheet>
  )
}
