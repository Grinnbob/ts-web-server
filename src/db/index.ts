import { Pool } from 'pg';

export const pool = new Pool({
    user: 'db_user',
    host: 'localhost',
    database: 'db_name',
    password: 'db_password',
    port: 5432,
});
