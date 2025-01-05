-- Create the applied migrations table
CREATE TABLE pgmig_applied_migrations(
    id bigserial NOT NULL PRIMARY KEY, -- The id of the migration
    index INT NOT NULL, -- The index of the migration
    name text NOT NULL, -- The name of the migration
    source text NOT NULL, -- The source of the migration
    checksum bytea, -- The checksum of the migration (auto-generated from source)
    direction text NOT NULL, -- The direction of the migration
    created_at timestamptz NOT NULL DEFAULT NOW(), -- The time the migration was applied
    obsolete boolean NOT NULL DEFAULT FALSE, -- If the migration is obsolete
    version text NOT NULL -- The version of pgmig
);