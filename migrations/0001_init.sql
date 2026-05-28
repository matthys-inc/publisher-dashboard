-- Publisher Dashboard D1 schema

CREATE TABLE IF NOT EXISTS websites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  cms TEXT NOT NULL DEFAULT 'custom',
  connected INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS socials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  handle TEXT NOT NULL DEFAULT '',
  connected INTEGER NOT NULL DEFAULT 0,
  followers INTEGER NOT NULL DEFAULT 0,
  engagement_rate REAL NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  impressions INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  seo_keywords TEXT NOT NULL DEFAULT '[]',
  scheduled_at TEXT,
  target_websites TEXT NOT NULL DEFAULT '[]',
  send_to_socials INTEGER NOT NULL DEFAULT 0,
  social_platforms TEXT NOT NULL DEFAULT '[]',
  social_caption TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'scheduled',
  read_time INTEGER NOT NULL DEFAULT 1,
  published_url TEXT NOT NULL DEFAULT '',
  seo_score INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  google_analytics_connected INTEGER NOT NULL DEFAULT 0,
  google_analytics_property_id TEXT NOT NULL DEFAULT '',
  search_console_connected INTEGER NOT NULL DEFAULT 0,
  search_console_site_url TEXT NOT NULL DEFAULT '',
  linkedin_connected INTEGER NOT NULL DEFAULT 0,
  twitter_connected INTEGER NOT NULL DEFAULT 0,
  wordpress_connected INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO settings (id) VALUES (1);
