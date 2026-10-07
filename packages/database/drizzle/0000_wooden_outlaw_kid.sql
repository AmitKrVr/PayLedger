CREATE TYPE "public"."audit_actor_type" AS ENUM('USER', 'ADMIN', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."audit_status" AS ENUM('SUCCESS', 'FAILURE');--> statement-breakpoint
CREATE TYPE "public"."admin_role" AS ENUM('ADMIN', 'SUPER_ADMIN');--> statement-breakpoint
CREATE TYPE "public"."admin_status" AS ENUM('ACTIVE', 'BLOCKED', 'SUSPENDED');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('PENDING', 'ACTIVE', 'BLOCKED');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('CREATED', 'PROCESSING', 'SUCCESS', 'FAILED', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."transaction_source_type" AS ENUM('PAYMENT', 'TRANSFER', 'WITHDRAWAL', 'REVERSAL');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('PENDING', 'COMPLETED', 'FAILED', 'REVERSED');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('DEPOSIT', 'TRANSFER', 'TRANSFER_REVERSAL', 'WITHDRAWAL');--> statement-breakpoint
CREATE TYPE "public"."ledger_direction" AS ENUM('CREDIT', 'DEBIT');--> statement-breakpoint
CREATE TYPE "public"."wallet_status" AS ENUM('ACTIVE', 'BLOCKED');--> statement-breakpoint
CREATE TYPE "public"."wallet_type" AS ENUM('USER', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."transfer_status" AS ENUM('PENDING', 'COMPLETED', 'FAILED', 'REVERSED');--> statement-breakpoint
CREATE TYPE "public"."withdrawal_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_type" "audit_actor_type" NOT NULL,
	"actor_user_id" uuid,
	"actor_admin_id" uuid,
	"action" varchar(100) NOT NULL,
	"status" "audit_status" NOT NULL,
	"target_type" varchar(50) NOT NULL,
	"target_id" varchar(100),
	"metadata" jsonb,
	"request_id" varchar(64),
	"ip_address" "inet",
	"user_agent" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"admin_id" uuid NOT NULL,
	"refresh_token_hash" varchar(64) NOT NULL,
	"refresh_token_jti" uuid NOT NULL,
	"device_name" varchar(100),
	"ip_address" "inet",
	"user_agent" varchar(500),
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_sessions_refresh_token_jti_unique" UNIQUE("refresh_token_jti")
);
--> statement-breakpoint
CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"mobile" varchar(20) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" "admin_role" DEFAULT 'ADMIN' NOT NULL,
	"status" "admin_status" DEFAULT 'ACTIVE' NOT NULL,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_mobile_unique" UNIQUE("mobile"),
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token_hash" varchar(64) NOT NULL,
	"refresh_token_jti" uuid NOT NULL,
	"device_name" varchar(100),
	"ip_address" "inet",
	"user_agent" varchar(500),
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_sessions_refresh_token_jti_unique" UNIQUE("refresh_token_jti")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"mobile" varchar(20) NOT NULL,
	"email" varchar(255),
	"password_hash" varchar(255) NOT NULL,
	"status" "user_status" DEFAULT 'PENDING' NOT NULL,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_mobile_unique" UNIQUE("mobile"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"wallet_type" "wallet_type" DEFAULT 'USER' NOT NULL,
	"balance_paise" bigint DEFAULT 0 NOT NULL,
	"held_paise" bigint DEFAULT 0 NOT NULL,
	"total_credited_paise" bigint DEFAULT 0 NOT NULL,
	"total_debited_paise" bigint DEFAULT 0 NOT NULL,
	"currency" char(3) DEFAULT 'INR' NOT NULL,
	"status" "wallet_status" DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_user_system_type_check" CHECK (
                (
                    "wallets"."wallet_type" = 'USER'
                    AND "wallets"."user_id" IS NOT NULL
                )
                OR
                (
                    "wallets"."wallet_type" = 'SYSTEM'
                    AND "wallets"."user_id" IS NULL
                )
            ),
	CONSTRAINT "wallets_balance_non_negative_check" CHECK ("wallets"."balance_paise" >= 0),
	CONSTRAINT "wallets_held_non_negative_check" CHECK ("wallets"."held_paise" >= 0),
	CONSTRAINT "wallets_held_not_greater_than_balance_check" CHECK ("wallets"."held_paise" <= "wallets"."balance_paise"),
	CONSTRAINT "wallets_total_credited_non_negative_check" CHECK ("wallets"."total_credited_paise" >= 0),
	CONSTRAINT "wallets_total_debited_non_negative_check" CHECK ("wallets"."total_debited_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"order_id" varchar(100) NOT NULL,
	"payment_id" varchar(100),
	"provider" varchar(50) NOT NULL,
	"amount_paise" bigint NOT NULL,
	"currency" char(3) DEFAULT 'INR' NOT NULL,
	"status" "payment_status" DEFAULT 'CREATED' NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"failure_reason" varchar(500),
	"metadata" jsonb,
	"paid_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "payments_payment_id_unique" UNIQUE("payment_id"),
	CONSTRAINT "payments_amount_positive_check" CHECK ("payments"."amount_paise" > 0)
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reference_id" varchar(32) NOT NULL,
	"type" "transaction_type" NOT NULL,
	"status" "transaction_status" NOT NULL,
	"user_id" uuid NOT NULL,
	"source_type" "transaction_source_type" NOT NULL,
	"source_id" uuid NOT NULL,
	"description" varchar(500),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "transactions_reference_id_unique" UNIQUE("reference_id")
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"transaction_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"amount_paise" bigint NOT NULL,
	"direction" "ledger_direction" NOT NULL,
	"balance_before_paise" bigint NOT NULL,
	"balance_after_paise" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_entries_amount_positive_check" CHECK ("ledger_entries"."amount_paise" > 0),
	CONSTRAINT "ledger_entries_balance_before_non_negative_check" CHECK ("ledger_entries"."balance_before_paise" >= 0),
	CONSTRAINT "ledger_entries_balance_after_non_negative_check" CHECK ("ledger_entries"."balance_after_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"transaction_id" uuid NOT NULL,
	"sender_wallet_id" uuid NOT NULL,
	"receiver_wallet_id" uuid NOT NULL,
	"amount_paise" bigint NOT NULL,
	"fee_paise" bigint NOT NULL,
	"total_paise" bigint NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"status" "transfer_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "transfers_transaction_id_unique" UNIQUE("transaction_id"),
	CONSTRAINT "transfers_amount_positive_check" CHECK ("transfers"."amount_paise" > 0),
	CONSTRAINT "transfers_fee_non_negative_check" CHECK ("transfers"."fee_paise" >= 0),
	CONSTRAINT "transfers_total_positive_check" CHECK ("transfers"."total_paise" > 0),
	CONSTRAINT "transfers_total_matches_amount_fee_check" CHECK ("transfers"."total_paise" = "transfers"."amount_paise" + "transfers"."fee_paise"),
	CONSTRAINT "transfers_sender_receiver_different_check" CHECK ("transfers"."sender_wallet_id" <> "transfers"."receiver_wallet_id")
);
--> statement-breakpoint
CREATE TABLE "withdrawals" (
	"id" uuid PRIMARY KEY NOT NULL,
	"transaction_id" uuid,
	"wallet_id" uuid NOT NULL,
	"amount_paise" bigint NOT NULL,
	"status" "withdrawal_status" DEFAULT 'PENDING' NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"rejection_reason" varchar(500),
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"processed_by_admin_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "withdrawals_amount_positive_check" CHECK ("withdrawals"."amount_paise" > 0)
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_admin_id_admins_id_fk" FOREIGN KEY ("actor_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_sender_wallet_id_wallets_id_fk" FOREIGN KEY ("sender_wallet_id") REFERENCES "public"."wallets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_receiver_wallet_id_wallets_id_fk" FOREIGN KEY ("receiver_wallet_id") REFERENCES "public"."wallets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_processed_by_admin_id_admins_id_fk" FOREIGN KEY ("processed_by_admin_id") REFERENCES "public"."admins"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_admin_id_idx" ON "audit_logs" USING btree ("actor_admin_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_target_idx" ON "audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_sessions_admin_id_idx" ON "admin_sessions" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "admin_sessions_expires_at_idx" ON "admin_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "admins_status_idx" ON "admins" USING btree ("status");--> statement-breakpoint
CREATE INDEX "admins_created_at_idx" ON "admins" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_sessions_expires_at_idx" ON "user_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "wallets_user_id_idx" ON "wallets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wallets_type_idx" ON "wallets" USING btree ("wallet_type");--> statement-breakpoint
CREATE INDEX "wallets_status_idx" ON "wallets" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "wallets_user_unique_idx" ON "wallets" USING btree ("user_id") WHERE "wallets"."wallet_type" = 'USER';--> statement-breakpoint
CREATE INDEX "payments_user_id_idx" ON "payments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_created_at_idx" ON "payments" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_user_idempotency_unique_idx" ON "payments" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "transactions_user_id_idx" ON "transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "transactions_type_idx" ON "transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "transactions_status_idx" ON "transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "transactions_created_at_idx" ON "transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "transactions_source_idx" ON "transactions" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_transaction_id_idx" ON "ledger_entries" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_wallet_id_idx" ON "ledger_entries" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_created_at_idx" ON "ledger_entries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "transfers_sender_wallet_id_idx" ON "transfers" USING btree ("sender_wallet_id");--> statement-breakpoint
CREATE INDEX "transfers_receiver_wallet_id_idx" ON "transfers" USING btree ("receiver_wallet_id");--> statement-breakpoint
CREATE INDEX "transfers_status_idx" ON "transfers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "transfers_created_at_idx" ON "transfers" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "transfers_sender_idempotency_unique_idx" ON "transfers" USING btree ("sender_wallet_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "withdrawals_wallet_id_idx" ON "withdrawals" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "withdrawals_status_idx" ON "withdrawals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "withdrawals_requested_at_idx" ON "withdrawals" USING btree ("requested_at");--> statement-breakpoint
CREATE INDEX "withdrawals_processed_by_admin_idx" ON "withdrawals" USING btree ("processed_by_admin_id");--> statement-breakpoint
CREATE UNIQUE INDEX "withdrawals_wallet_idempotency_unique_idx" ON "withdrawals" USING btree ("wallet_id","idempotency_key");