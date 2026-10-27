/** @type {import('node-pg-migrate').MigrationBuilder} */
/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * Initial schema for china-history-map.
 * Core domain: dynasties, factions, faction_geometries, events, wars
 * Platform:   users, refresh_tokens, annotations, share_links, change_logs
 *
 * Year convention: negative = BCE (e.g. -770 = 770 BC), positive = CE.
 *
 * NOTE on storage strategy:
 *   Spatial data (faction polygons & war march paths) is stored as JSONB
 *   containing raw GeoJSON Geometry objects, NOT as PostGIS geography types.
 *   Rationale: this project's query pattern is "filter factions by year", not
 *   spatial intersection queries; the frontend (MapLibre) consumes GeoJSON
 *   directly. This keeps the stack dependency-free of PostGIS while remaining
 *   trivially upgradeable — add a `geom geography(...)` column + PostGIS
 *   extension later if server-side spatial queries are ever needed.
 */
exports.up = (pgm) => {
  // ---------------- shared: updated_at trigger function ----------------
  pgm.sql(`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // ============================================================
  // dynasties — a period or sub-period (e.g. 东周 / 春秋 / 战国)
  // ============================================================
  pgm.createTable('dynasties', {
    id: { type: 'text', primaryKey: true },
    name: { type: 'text', notNull: true },
    name_en: { type: 'text' },
    start_year: { type: 'integer', notNull: true },
    end_year: { type: 'integer', notNull: true },
    color: { type: 'text', notNull: true },
    parent_id: { type: 'text', references: 'dynasties(id)', onDelete: 'SET NULL' },
    sort_order: { type: 'integer', notNull: true, default: 0 },
    description: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.createIndex('dynasties', 'parent_id');
  pgm.createIndex('dynasties', ['start_year', 'end_year']);
  pgm.sql(`
    CREATE TRIGGER trg_dynasties_updated_at
    BEFORE UPDATE ON dynasties
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  // ============================================================
  // factions — a power within a dynasty (e.g. 秦, 楚, 魏, 蜀, 吴)
  // ============================================================
  pgm.createTable('factions', {
    id: { type: 'text', primaryKey: true },
    dynasty_id: { type: 'text', references: 'dynasties(id)', onDelete: 'SET NULL' },
    name: { type: 'text', notNull: true },
    name_en: { type: 'text' },
    start_year: { type: 'integer', notNull: true },
    end_year: { type: 'integer', notNull: true },
    color: { type: 'text', notNull: true },
    type: { type: 'text' }, // kingdom | state | tribe | empire | dynasty
    capital: { type: 'text' },
    capital_lat: { type: 'double precision' },
    capital_lng: { type: 'double precision' },
    description: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.createIndex('factions', 'dynasty_id');
  pgm.createIndex('factions', ['start_year', 'end_year']);
  pgm.sql(`
    CREATE TRIGGER trg_factions_updated_at
    BEFORE UPDATE ON factions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  // ============================================================
  // faction_geometries — polygon ranges stored as GeoJSON (JSONB)
  // A faction may have multiple ranges across sub-periods.
  // ============================================================
  pgm.createTable('faction_geometries', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    faction_id: { type: 'text', notNull: true, references: 'factions(id)', onDelete: 'CASCADE' },
    start_year: { type: 'integer', notNull: true },
    end_year: { type: 'integer', notNull: true },
    geom: { type: 'jsonb', notNull: true }, // GeoJSON MultiPolygon geometry object
    source: { type: 'text' }, // CHGIS | tanqixiang | geonames | custom
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.createIndex('faction_geometries', 'faction_id');
  pgm.createIndex('faction_geometries', 'geom', { method: 'GIN' });
  pgm.createIndex('faction_geometries', ['start_year', 'end_year']);
  pgm.sql(`
    CREATE TRIGGER trg_faction_geometries_updated_at
    BEFORE UPDATE ON faction_geometries
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  // ============================================================
  // events — historical events (battles, reforms, treaties, ...)
  // ============================================================
  pgm.createTable('events', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    year: { type: 'integer', notNull: true },
    year_label: { type: 'text', notNull: true }, // "前632年" / "公元220年"
    title: { type: 'text', notNull: true },
    type: { type: 'text', notNull: true, default: "'event'" }, // event|battle|treaty|reform|founding|fall
    description: { type: 'text' },
    location_label: { type: 'text' },
    lat: { type: 'double precision' },
    lng: { type: 'double precision' },
    dynasty_id: { type: 'text', references: 'dynasties(id)', onDelete: 'SET NULL' },
    faction_ids: { type: 'text[]' },
    metadata: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.createIndex('events', 'year');
  pgm.createIndex('events', 'dynasty_id');
  pgm.createIndex('events', 'type');
  pgm.createIndex('events', 'faction_ids', { method: 'GIN' });
  pgm.sql(`
    CREATE TRIGGER trg_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  // ============================================================
  // wars — attacker/defender pairs with an optional march path
  // path stored as GeoJSON LineString (JSONB)
  // ============================================================
  pgm.createTable('wars', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    year: { type: 'integer', notNull: true },
    year_label: { type: 'text', notNull: true },
    name: { type: 'text', notNull: true },
    attacker_faction_id: { type: 'text', references: 'factions(id)', onDelete: 'SET NULL' },
    defender_faction_id: { type: 'text', references: 'factions(id)', onDelete: 'SET NULL' },
    attacker_label: { type: 'text' }, // fallback when no faction record
    defender_label: { type: 'text' },
    path: { type: 'jsonb' }, // GeoJSON LineString geometry object
    result: { type: 'text' }, // attacker_win|defender_win|draw|unknown
    description: { type: 'text' },
    metadata: { type: 'jsonb', notNull: true, default: pgm.func("'{}'::jsonb") },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.createIndex('wars', 'year');
  pgm.createIndex('wars', 'attacker_faction_id');
  pgm.createIndex('wars', 'defender_faction_id');
  pgm.createIndex('wars', 'path', { method: 'GIN' });
  pgm.sql(`
    CREATE TRIGGER trg_wars_updated_at
    BEFORE UPDATE ON wars
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  // ============================================================
  // users — RBAC: reader | user | editor | admin
  // ============================================================
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    email: { type: 'text', notNull: true, unique: true },
    username: { type: 'text', notNull: true, unique: true },
    password_hash: { type: 'text', notNull: true },
    role: { type: 'text', notNull: true, default: "'user'" },
    display_name: { type: 'text' },
    is_active: { type: 'boolean', notNull: true, default: true },
    last_login_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.sql(`
    CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  // ============================================================
  // refresh_tokens — server-side stored, hashed (HttpOnly cookie)
  // ============================================================
  pgm.createTable('refresh_tokens', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
    token_hash: { type: 'text', notNull: true, unique: true },
    expires_at: { type: 'timestamptz', notNull: true },
    revoked_at: { type: 'timestamptz' },
    user_agent: { type: 'text' },
    ip_address: { type: 'inet' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.createIndex('refresh_tokens', 'user_id');
  pgm.createIndex('refresh_tokens', 'expires_at');

  // ============================================================
  // annotations — user notes, private or optionally public
  // ============================================================
  pgm.createTable('annotations', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
    event_id: { type: 'uuid', references: 'events(id)', onDelete: 'CASCADE' },
    title: { type: 'text', notNull: true },
    content: { type: 'text' },
    lat: { type: 'double precision' },
    lng: { type: 'double precision' },
    is_public: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.createIndex('annotations', 'user_id');
  pgm.createIndex('annotations', 'event_id');
  pgm.createIndex('annotations', 'is_public', { where: "is_public = TRUE" });
  pgm.sql(`
    CREATE TRIGGER trg_annotations_updated_at
    BEFORE UPDATE ON annotations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  `);

  // ============================================================
  // share_links — tokenized view-state snapshots
  // ============================================================
  pgm.createTable('share_links', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
    token: { type: 'text', notNull: true, unique: true },
    view_state: { type: 'jsonb', notNull: true },
    expires_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.createIndex('share_links', 'token');

  // ============================================================
  // change_logs — audit trail for all historical data edits
  // ============================================================
  pgm.createTable('change_logs', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', references: 'users(id)', onDelete: 'SET NULL' },
    table_name: { type: 'text', notNull: true },
    record_id: { type: 'text' },
    action: { type: 'text', notNull: true }, // INSERT | UPDATE | DELETE
    old_data: { type: 'jsonb' },
    new_data: { type: 'jsonb' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('NOW()') },
  });
  pgm.createIndex('change_logs', ['table_name', 'record_id']);
  pgm.createIndex('change_logs', 'user_id');
  pgm.createIndex('change_logs', 'created_at');
};

exports.down = (pgm) => {
  pgm.dropTable('change_logs');
  pgm.dropTable('share_links');
  pgm.dropTable('annotations');
  pgm.dropTable('refresh_tokens');
  pgm.dropTable('users');
  pgm.dropTable('wars');
  pgm.dropTable('events');
  pgm.dropTable('faction_geometries');
  pgm.dropTable('factions');
  pgm.dropTable('dynasties');
  pgm.sql('DROP FUNCTION IF EXISTS set_updated_at()');
};
