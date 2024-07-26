import { AnySoupElement } from "@tscircuit/soup"
import { su } from "@tscircuit/soup-util"

export function deriveSelector(element: AnySoupElement): string {
  if ('name' in element && element.name) {
    return element.name
  }

  const type = element.type.replace(/^(source_|schematic_|pcb_)/, '')
  const id = su.getIdForElement(element)

  return `${type}#${id}`
}
