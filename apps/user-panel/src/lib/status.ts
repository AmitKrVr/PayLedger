import type { StatusTone } from "@/components/ui/status-pill"
import type { PaymentStatus } from "@/lib/api/payments"
import type { TransactionStatus } from "@/lib/api/transactions"
import type { TransferStatus } from "@/lib/api/transfers"
import type { WithdrawalStatus } from "@/lib/api/withdrawals"

export function paymentStatusTone(status: PaymentStatus): StatusTone {
  switch (status) {
    case "SUCCESS":
      return "success"
    case "CREATED":
    case "PROCESSING":
      return "warning"
    case "FAILED":
    case "CANCELLED":
    case "EXPIRED":
      return "danger"
  }
}

export function transferStatusTone(status: TransferStatus): StatusTone {
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

export function transactionStatusTone(status: TransactionStatus): StatusTone {
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

export function withdrawalStatusTone(status: WithdrawalStatus): StatusTone {
  switch (status) {
    case "APPROVED":
      return "success"
    case "PENDING":
      return "warning"
    case "REJECTED":
      return "danger"
  }
}
