-- Echte Google OAuth: tokenopslag (server-side, lekt nooit naar de browser).
-- Deze kolommen bewaren de access/refresh tokens en metadata van de gekoppelde
-- Google-account. connected-status wordt afgeleid van het refresh_token.

ALTER TABLE settings ADD COLUMN google_access_token TEXT NOT NULL DEFAULT '';
ALTER TABLE settings ADD COLUMN google_refresh_token TEXT NOT NULL DEFAULT '';
ALTER TABLE settings ADD COLUMN google_token_expiry INTEGER NOT NULL DEFAULT 0;
ALTER TABLE settings ADD COLUMN google_email TEXT NOT NULL DEFAULT '';
