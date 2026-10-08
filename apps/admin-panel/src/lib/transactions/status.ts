import type { StatusVariant } from "@/components/status-badge"
import type { TransactionStatus, TransactionType } from "@/lib/api/transactions"

export function transactionStatusVariant(status: TransactionStatus): StatusVariant {
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

export function transactionStatusLabel(status: TransactionStatus): string {
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

export function transactionTypeLabel(type: TransactionType): string {
  switch (type) {
    case "DEPOSIT":
      return "Deposit"
    case "TRANSFER":
      return "Transfer"
    case "TRANSFER_REVERSAL":
      return "Reversal"
    case "WITHDRAWAL":
      return "Withdrawal"
  }
}
