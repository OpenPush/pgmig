-- This auto-generates the checksum column for the applied migrations table
-- Load required pgcrypto extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create the checksum function
CREATE OR REPLACE FUNCTION pgmig_checksum_tg()
    RETURNS TRIGGER
    AS $$
BEGIN
    IF tg_op = 'INSERT' OR tg_op = 'UPDATE' THEN
        NEW.checksum = digest(NEW.source, 'sha256');
        RETURN NEW;
    END IF;
END;
$$
LANGUAGE plpgsql;

-- Create the checksum trigger
CREATE TRIGGER pgmig_checksum
    BEFORE INSERT OR UPDATE ON pgmig_applied_migrations
    FOR EACH ROW
    EXECUTE PROCEDURE pgmig_checksum_tg();
