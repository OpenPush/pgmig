import postgres from 'postgres';
import pgmig from '../../index.mjs';
import { join } from 'path';
import readline from 'readline';

// Create a readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Wait for user input
rl.question('Enter PostgreSQL connection string: ', async (con) => {
    rl.close();

    // Create a postgres.js instance -- See https://github.com/porsager/postgres?tab=readme-ov-file#postgresurl-options
    let sql = postgres(con, {
        onnotice: () => {
            // Do something with the notice?
        },
    });

    // Create a pgmig instance
    let migrations = await pgmig({
        sql,
        paths: [
            join(new URL('.', import.meta.url).pathname, 'migrations'),
        ],

        // Get the result of each migration
        onResult: (direction, migration, result) => {
            console.log(`[${direction}] Migration "${migration.name}" result: ${JSON.stringify(result, null, 4)}\n`);
        },
        onFail: async (direction, migration) => {
            console.log(`[${direction}] Migration "${migration.name}" failed`);
        }
    });

    // Console log all found migrations
    console.log(migrations.list);
    console.log();

    // Apply the up migrations
    await migrations.up(['foo']); // Only run the `foo` up migration

    // Apply the down migrations
    await migrations.down();

    // Because this is a demo, clean up the database
    await migrations.removePgmig();

    // Close the connection if you're done with it
    await migrations.end();
});

// debug memory usage
process.on('exit', () => {
    let usage = process.memoryUsage();
    console.log(`Memory usage: ${usage.rss / 1024 / 1024} MB`);
});