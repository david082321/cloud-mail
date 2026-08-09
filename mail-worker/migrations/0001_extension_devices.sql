CREATE TABLE IF NOT EXISTS extension_device (
	device_id TEXT PRIMARY KEY,
	user_id INTEGER NOT NULL,
	name TEXT NOT NULL DEFAULT 'Chrome',
	refresh_token_hash TEXT NOT NULL,
	scopes TEXT NOT NULL DEFAULT '[]',
	revoked INTEGER NOT NULL DEFAULT 0,
	expires_time DATETIME NOT NULL,
	create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	last_used_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_extension_device_user
	ON extension_device(user_id, revoked, expires_time);

CREATE UNIQUE INDEX IF NOT EXISTS idx_extension_device_refresh_token
	ON extension_device(refresh_token_hash);

CREATE TABLE IF NOT EXISTS extension_push_subscription (
	subscription_id INTEGER PRIMARY KEY AUTOINCREMENT,
	device_id TEXT NOT NULL,
	user_id INTEGER NOT NULL,
	endpoint TEXT NOT NULL UNIQUE,
	p256dh TEXT NOT NULL,
	auth_key TEXT NOT NULL,
	expiration_time DATETIME,
	create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
	update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_extension_push_user
	ON extension_push_subscription(user_id, device_id);
