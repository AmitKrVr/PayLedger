import type { StatusVariant } from "@/components/status-badge"
import type { PaymentStatus } from "@/lib/api/payments"

export function paymentStatusVariant(status: PaymentStatus): StatusVariant {
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

export function paymentStatusLabel(status: PaymentStatus): string {
  switch (status) {
    case "CREATED":
      return "Created"
    case "PROCESSING":
      return "Processing"
    case "SUCCESS":
      return "Success"
    case "FAILED":
      return "Failed"
    case "CANCELLED":
      return "Cancelled"
    case "EXPIRED":
      return "Expired"
  }
}
