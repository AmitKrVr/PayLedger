const formatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
})

export function formatInr(amount: number): string {
  return formatter.format(amount)
}
