import type { StatusVariant } from "@/components/status-badge"
import type { TransferStatus } from "@/lib/api/transfers"

export function transferStatusVariant(status: TransferStatus): StatusVariant {
  switch (status) {
    case "COMPLETED":
      return "success"
    case "PENDING":
      return "warning"
    case "FAILED":
      return "danger"
    case "REVERSED":
      return "neutral"
  }
}

export function transferStatusLabel(status: TransferStatus): string {
  switch (status) {
    case "PENDING":
      return "Pending"
    case "COMPLETED":
      return "Completed"
    case "FAILED":
      return "Failed"
    case "REVERSED":
      return "Reversed"
  }
}
