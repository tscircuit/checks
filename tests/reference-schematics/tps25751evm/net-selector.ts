// Preserve TI net names beginning with a digit using CSS selector escaping.
export function netSelector(name: string) {
  return `net.${name.replace(/^[0-9]/, (digit) => `\\3${digit} `)}`
}
