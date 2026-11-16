// TI TPS25751EVM, SLVUCP9B figures 5-1 through 5-7 (pages 39-44).
// https://www.ti.com/lit/ug/slvucp9b/slvucp9b.pdf
// Schematic-only transcription: 261 physical components, 866 pins, seven sheets.
// Native symbols and automatic routing; local spacing follows the reviewed TSX.
import { PowerInput } from "./power-input"
import { UsbConnectors } from "./usb-connectors"
import { PowerStage } from "./power-stage"
import { PdController } from "./pd-controller"
import { PortProtection } from "./port-protection"
import { LiquidDetection } from "./liquid-detection"
import { TivaProgrammer } from "./tiva-programmer"

export function Tps25751Evm() {
  return (
    <board schLayout={{ layoutMode: "none" }}>
      <net name="GND" />
      <net name="730_VIN_3V3" />
      <net name="VBAT" />
      <net name="730_VBUS" />
      <net name="VSYS" />
      <net name="730_PPHV" />
      <net name="730_CC1" />
      <net name="730_CC2" />
      <net name="P_ADCIN1" />
      <net name="730_LDO_3V3" />
      <net name="P_ADCIN2" />
      <net name="730_VBUS_IN" />
      <net name="730_DRAIN" />
      <net name="P_ADCIN3" />
      <net name="P_ADCIN4" />
      <net name="730_LDO_1V5" />
      <net name="751_VBUS" />
      <net name="751_C_CC2" />
      <net name="751_C_SBU2" />
      <net name="TIVA_VBUS" />
      <net name="A_GPIO0" />
      <net name="A_GPIO1" />
      <net name="A_GPIO2" />
      <net name="A_GPIO3" />
      <net name="A_GPIO11" />
      <net name="PP5V" />
      <net name="P3V3" />
      <net name="I2Cc_SCL" />
      <net name="I2Cc_SDA" />
      <net name="I2Cc_IRQ" />
      <net name="I2Ct_SCL" />
      <net name="I2Ct_SDA" />
      <net name="I2Ct_IRQ" />
      <net name="LDO_3V3" />
      <net name="751_C_SBU1" />
      <net name="751_C_CC1" />
      <net name="VAC" />
      <net name="A_GPIO4" />
      <net name="A_GPIO5" />
      <net name="A_GPIO6" />
      <net name="A_GPIO7" />
      <net name="BAT" />
      <net name="751_PPHV" />
      <net name="751_CC2" />
      <net name="751_CC1" />
      <net name="TIVA_D_N" />
      <net name="TIVA_D_P" />
      <net name="751_D_N" />
      <net name="751_D_P" />
      <net name="ADCIN2" />
      <net name="751_DRAIN" />
      <net name="GPIO0" />
      <net name="GPIO1" />
      <net name="GPIO6" />
      <net name="GPIO7" />
      <net name="GPIO11" />
      <net name="ADCIN1" />
      <net name="I2Cc_SDA_FLASH" />
      <net name="GPIO_45P" />
      <net name="GPIO_45N" />
      <net name="LDO_1V5" />
      <net name="BQ_PG" />
      <net name="BQ_INT" />
      <net name="GPIO_NF" />
      <net name="GPIO_PF" />
      <net name="TEST2" />
      <net name="LD2" />
      <net name="TEST1" />
      <net name="GPIO3" />
      <net name="GPIO2" />
      <net name="LD1" />
      <net name="TPD_FLT" />
      <net name="TPD_VPWR" />
      <net name="TIVA_P3V3" />
      <net name="T_RST" />
      <net name="ICD_TDI" />
      <net name="ICD_TDO" />
      <net name="ICD_TCK" />
      <net name="ICD_TMS" />
      <net name="DBG_UART" />
      <net name="DBG_SDA" />
      <net name="DBG_SCL" />
      <net name="TIVA_5V" />
      <PowerInput />
      <UsbConnectors />
      <PowerStage />
      <PdController />
      <PortProtection />
      <LiquidDetection />
      <TivaProgrammer />
    </board>
  )
}
