# PGMig

A basic PostgreSQL migration library for [postgres.js](https://github.com/porsager/postgres) intended for use with [OpenPush](https://openpu.sh/). The goal is for simple `up` and `down` migrations; there is currently no rollback support.

## Folder Structure

Migrations should follow the specified folder structure, using a numbered primary index prefix for organization.

```
.
└── migrations
    ├── 1_extensions
    │   └── up.sql
    ├── 02_tables
    │   └── up.sql
    │   └── down.sql
    ├── 003_functions
    │   └── up.sql
    │   └── down.sql
    └── 0004_optionals
        └── down.sql
```

### Notes:

1) The index number (`:index_:migration-name`) can have any number of leading zeroes.
2) It is not required to have both `up` and `down` migrations.
3) JavaScript syntax (`up.js`, `down.js`) is not yet supported.

## Usage

See [examples](/examples) folder for more information.

```javascript
import postgres from 'postgres';
import pgmig from '@openpush/pgmig`;

// Create a postgres.js instance -- See https://github.com/porsager/postgres?tab=readme-ov-file#postgresurl-options
let sql = postgres('postgres://...',{});

let migrations = pgmig({
    sql,
    paths: [
        '/path/to/migrations',
        '/path/to/optional/migrations' // You can supply more than one path (optional migrations, for example)
    ],
});

// Console log all found migrations
console.log(migrations.list);

// Apply the up migrations
await migrations.up();

// Apply the down migrations
await migrations.down();

// Because this is a demo, clean up the database
await migrations.removePgmig();

// Close the connection if you're done with it
await migrations.end();
```

