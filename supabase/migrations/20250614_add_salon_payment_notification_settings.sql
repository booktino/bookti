ALTER TABLE salons
  ADD COLUMN IF NOT EXISTS enabled_payment_methods text[] NOT NULL DEFAULT '{vipps,apple_pay,google_pay,stripe,cash}',
  ADD COLUMN IF NOT EXISTS notify_sms_booking boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_push boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_email_receipt boolean NOT NULL DEFAULT true;
