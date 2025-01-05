-- Remove checksum trigger
DROP TRIGGER IF EXISTS pgmig_checksum ON pgmig_applied_migrations;

-- Remove checksum function
DROP FUNCTION IF EXISTS pgmig_checksum_tg;

-- Remove table
DROP TABLE IF EXISTS pgmig_applied_migrations;