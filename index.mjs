import { readdirSync, statSync, readFileSync } from 'fs';
import { join, dirname, parse } from 'path';
import { createHash } from 'crypto';

// Get the base directory of pgmig
const baseDir = new URL('.', import.meta.url).pathname;

// Get the version of pgmig
let version = '0.0.0-alpha.0';
try {
    version = JSON.parse(readFileSync(join(baseDir, '/package.json')))?.version
} catch { }

// Export the pgmig function
export default async function ({
    sql, // SQL connection (via postgres.js)
    paths = false, // Paths to search for migrations
    types = ['up', 'down'], // Which types of migrations to load
    onApply = false,
    onBefore = false,
    onError = false,
    onFail = false,
    onFinish = false,
    onResult = false,
    onSkip = false,
}) {
    try {
        // Validate the paths
        let _paths = (Array.isArray(paths) ? paths : [paths]).filter(Boolean);
        if ((!_paths.length || _paths.some(p => !statSync(p).isDirectory()))) {
            let error = new Error(`Invalid migration paths: ${_paths.join(', ')}`);
            onError && await onError(error);
            return Promise.reject(error);
        }

        // Validate the connection
        if (!sql) {
            let error = new Error('Missing sql connection');
            onError && await onError(null, error);
            return Promise.reject(error);
        }

        // Get a list of files
        let files = _paths.map(p => readdirSync(p, { recursive: true })
            .filter(f => f.endsWith('.sql'))
            .map(f => join(p, f))).flat(),
            list = { up: [], down: [] };

        // Split the files into up and down migrations
        for (let file of files) {
            let parsed = parse(file),
                type = parsed.name,
                [index, name] = (parsed.dir.match(/([^\/]*)\/*$/)[1]).split('_');

            // Validate the type
            if (!types.includes(type)) {
                continue;
            }

            // Add the migration to the list
            list[type].push({ file, index, name });
        }

        // Sort the migrations by index
        for (let type of types) {
            list[type] = list[type].sort((a, b) => a.index - b.index);
        }

        async function execute(direction = 'up', specific = null) {
            try {
                //  Begin the migrations
                // Get the migrations, do not mutate the primary list
                let migrations = [
                    ...(list[direction] ?? [])
                ].filter((m => specific ? (Array.isArray(specific) ? specific : [specific]).includes(m.name) : true));

                // Check if any migrations exist
                if (!migrations?.length) {
                    let error = new Error(`No ${direction} migrations found`);
                    onError && await onError(direction, error);
                    return Promise.reject(error);
                }

                // Ensure the database is ready for migrations
                let autoChecksum = await ensure(sql);

                // Run the onBefore hook
                onBefore && await onBefore(direction, migrations);

                for (let migration of migrations) {
                    // Read the source + checksum
                    // XXX: Improve the source read + checksum
                    let source = readFileSync(migration.file, 'utf8'),
                        checksum = createHash('sha256').update(source).digest();

                    // Check if the migration has already been applied
                    if ((await sql`
                        SELECT EXISTS(SELECT
                            1
                        FROM
                            pgmig_applied_migrations
                        WHERE
                            name = ${migration.name}
                            AND index = ${migration.index}
                            AND direction = ${direction}
                            AND obsolete = FALSE
                            AND checksum = ${checksum})
                    `)?.[0]?.exists) {
                        onSkip && await onSkip(direction, migration);
                        continue; // Skip if the migration has already been applied
                    }

                    // Flag obsolete migrations based on directions
                    await sql`
                        UPDATE
                            pgmig_applied_migrations
                        SET
                            obsolete = TRUE
                        WHERE
                            name = ${migration.name}
                            AND direction = ${direction == 'up' ? 'down' : 'up'}
                    `;

                    // Apply the migration within a transaction
                    await sql.begin(async (tx) => await tx.file(migration.file).then(async (res) => {
                        onResult && await onResult(direction, migration, res);
                    }).catch(async (err) => {
                        onFail && await onFail(direction, migration);
                    }));

                    // Create the migration record
                    let mig = {
                        index: migration.index,
                        name: migration.name,
                        source,
                        direction,
                        version,
                        checksum: autoChecksum ? null : checksum
                    };

                    // Insert the migration into the applied migrations table
                    await sql`INSERT INTO pgmig_applied_migrations ${sql(mig, Object.keys(mig))} `;

                    // Call the onApply callback
                    onApply && await onApply(direction, mig);
                }

                // Call the onFinish callback
                onFinish && await onFinish(direction);
            } catch (error) {
                // Call the onError callback
                onError && await onError(direction, error);
                return Promise.reject(error);
            }
        }

        // Ensure the applied migrations table exists and the checksum can be auto-generated
        async function ensure(sql) {
            // Ensure the applied migrations table exists
            await sql`
                SELECT
                    'pgmig_applied_migrations'::regclass
            `.catch(async (err) => await sql.file(join(baseDir, '/sql/table.sql')));

            // If pgcrypto is available, ensure the checksum is setup to be auto-generated
            if ((await sql.file(join(baseDir, '/sql/extension_check.sql'), ['pgcrypto']).then(async (check) => {
                return check?.[0]?.installed;
            })) !== null) {
                // If the pgmig_checksum trigger doesn't exist, create it
                return await sql`
                    SELECT
                        'pgmig_checksum_tg()'::regprocedure
                `.catch(async () => await sql.file(join(baseDir, '/sql/checksum.sql'))).then(() => true).catch(() => false);
            }

            // Return false if auto-checksum is not available
            return false;
        }

        // Purge the migrations table
        async function purge() {
            return await sql.begin(async (tx) => tx.file(join(baseDir, '/sql/purge_pgmig.sql')));
        }

        // Return the migrations and up/down functions
        return Promise.resolve({
            list,
            up: (specific = null) => execute('up', specific ?? null),
            down: (specific = null) => execute('down', specific ?? null),
            end: async () => await sql.end({ timeout: 5 }),
            removePgmig: async () => await purge(),
        });
    } catch (error) {
        onError && await onError(null, error);
        return Promise.reject(error);
    }
}
