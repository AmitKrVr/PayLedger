export function computeSerial(page: number, limit: number, index: number): number {
  return (page - 1) * limit + index + 1
}
