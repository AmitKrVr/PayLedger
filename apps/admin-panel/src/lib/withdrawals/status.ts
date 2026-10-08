import type { StatusVariant } from "@/components/status-badge"
import type { WithdrawalStatus } from "@/lib/api/withdrawals"

export function withdrawalStatusVariant(status: WithdrawalStatus): StatusVariant {
  switch (status) {
    case "PENDING":
      return "warning"
    case "APPROVED":
      return "success"
    case "REJECTED":
      return "danger"
  }
}

export function withdrawalStatusLabel(status: WithdrawalStatus): string {
  switch (status) {
    case "PENDING":
      return "Pending"
    case "APPROVED":
      return "Approved"
    case "REJECTED":
      return "Rejected"
  }
}
