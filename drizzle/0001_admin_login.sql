ALTER TABLE portal_owner ADD COLUMN admin_code TEXT;
--> statement-breakpoint
ALTER TABLE portal_owner ADD COLUMN admin_salt TEXT;
--> statement-breakpoint
ALTER TABLE portal_owner ADD COLUMN admin_hash TEXT;
