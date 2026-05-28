-- Optionele seed: lichte demo-data zodat het dashboard niet leeg start.
-- Verwijder/leeg deze migration als je clean wil starten.

INSERT OR IGNORE INTO websites (id, name, url, cms, connected) VALUES
  ('web_1', 'TechInzichten Blog', 'https://techinzichten.nl', 'wordpress', 1),
  ('web_2', 'Duurzaam Leven', 'https://duurzaamleven.org', 'custom', 1);

INSERT OR IGNORE INTO socials (id, name, handle, connected, followers, engagement_rate, clicks, impressions) VALUES
  ('linkedin',  'LinkedIn',    '@techinzichten',     1, 1450, 4.8, 320, 8400),
  ('twitter',   'Twitter / X', '@TechInzichtenNL',   1,  820, 3.2, 190, 5300),
  ('facebook',  'Facebook',    'techinzichten.nl',   0,  310, 1.5,  45, 1200),
  ('instagram', 'Instagram',   '@techinzichten_ig',  0,  490, 2.1,  65, 1800);

UPDATE settings
SET linkedin_connected = 1,
    twitter_connected = 1,
    wordpress_connected = 1
WHERE id = 1;
