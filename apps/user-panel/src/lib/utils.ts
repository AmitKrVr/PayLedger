import type { KeyboardEvent } from "react"

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ")
}

/** Strips everything but digits as the user types, so a mobile-number
 * field can never contain letters or symbols in the first place. */
export function digitsOnly(value: string, maxLength?: number): string {
  const digits = value.replace(/\D/g, "")
  return maxLength ? digits.slice(0, maxLength) : digits
}

/** Blocks the keys HTML's type="number" otherwise accepts but which make
 * no sense in an amount field (e/E for exponents, +/- for sign). */
export function blockInvalidNumberKeys(e: KeyboardEvent<HTMLInputElement>): void {
  if (["e", "E", "+", "-"].includes(e.key)) {
    e.preventDefault()
  }
}
