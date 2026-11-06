CREATE TABLE application_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0 CHECK(email_verified IN (0,1)),
  google_sub TEXT UNIQUE,
  token_version INTEGER NOT NULL DEFAULT 0,
  disabled INTEGER NOT NULL DEFAULT 0 CHECK(disabled IN (0,1))
);
CREATE TABLE profiles (
  id TEXT PRIMARY KEY REFERENCES application_users(id),
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  role TEXT NOT NULL DEFAULT 'free' CHECK(role IN ('free','premium')),
  created_at TEXT NOT NULL
);
CREATE TABLE todos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES application_users(id),
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 500),
  completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK(priority IN ('low','normal','high')),
  created_at TEXT NOT NULL
);
CREATE INDEX todos_by_owner ON todos(user_id,created_at DESC);
CREATE TABLE _drivebase_documents (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  body TEXT NOT NULL CHECK(json_valid(body)),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(collection,id)
);
