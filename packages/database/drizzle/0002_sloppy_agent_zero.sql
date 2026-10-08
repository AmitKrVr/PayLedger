CREATE TYPE "public"."gateway_payment_status" AS ENUM('CREATED', 'PROCESSING', 'SUCCESS', 'FAILED');--> statement-breakpoint
CREATE TABLE "gateway_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar(100) NOT NULL,
	"payment_id" varchar(100) NOT NULL,
	"amount_paise" bigint NOT NULL,
	"currency" char(3) DEFAULT 'INR' NOT NULL,
	"status" "gateway_payment_status" DEFAULT 'CREATED' NOT NULL,
	"failure_reason" varchar(500),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	CONSTRAINT "gateway_payments_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "gateway_payments_payment_id_unique" UNIQUE("payment_id"),
	CONSTRAINT "gateway_payments_amount_positive_check" CHECK ("gateway_payments"."amount_paise" > 0)
);
--> statement-breakpoint
CREATE INDEX "gateway_payments_status_idx" ON "gateway_payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gateway_payments_created_at_idx" ON "gateway_payments" USING btree ("created_at");