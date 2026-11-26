CREATE TABLE portal_campaigns (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('draft', 'published', 'paused')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE TABLE portal_campaign_members (
  campaign_id TEXT NOT NULL REFERENCES portal_campaigns(id),
  account_id TEXT NOT NULL REFERENCES portal_accounts(id),
  status TEXT NOT NULL CHECK (status IN ('pending', 'joined')),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (campaign_id, account_id)
);
--> statement-breakpoint
CREATE INDEX portal_campaign_members_account ON portal_campaign_members (account_id);
