/**
 * node-pg-migrate configuration.
 * DATABASE_URL comes from server/.env (loaded via dotenv below).
 * Run: npm run migrate        (up)
 *      npm run migrate:down   (rollback last)
 *      npm run migrate:create <name>
 */
require('dotenv').config();

module.exports = {
  dir: __dirname + '/migrations',
  migrationsSchema: 'public',
  verbose: true,
  // DATABASE_URL is read automatically from the environment.
};
