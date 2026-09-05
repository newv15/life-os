-- =============================================================================
-- 0014 - Index the age of processed updates
--
-- telegram_updates exists only to stop Telegram's retries from recording the
-- same expense twice, and an entry stops mattering within minutes. Nothing was
-- deleting them, so the table grew by one row per message forever inside a
-- 500 MB free tier.
--
-- The webhook now prunes anything older than two days, occasionally rather than
-- on every message. This index is what keeps that delete cheap.
-- =============================================================================

create index telegram_updates_processed_at_idx on telegram_updates (processed_at);
