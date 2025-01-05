-- Query to check if an extension is installed or available
SELECT
    installed
FROM (
    SELECT
        name,
        installed
    FROM (
        SELECT
            extname AS name,
            TRUE AS installed
        FROM
            pg_extension
        UNION ALL
        SELECT
            name,
            FALSE
        FROM
            pg_available_extensions
        WHERE
            name NOT IN (
                SELECT
                    extname
                FROM
                    pg_extension)) subquery
        WHERE
            name = $1) final_query;
