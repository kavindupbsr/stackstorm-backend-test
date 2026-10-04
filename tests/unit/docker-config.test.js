// Jest test runner provides describe and it globals
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '../../');

describe('STORM-002: Docker Compose & Infrastructure Configuration', () => {
  it('should have a valid docker-compose.yml with postgres and redis services', () => {
    const composePath = path.join(ROOT_DIR, 'docker-compose.yml');
    assert.ok(fs.existsSync(composePath), 'docker-compose.yml must exist in root');

    const content = fs.readFileSync(composePath, 'utf-8');

    // Service definitions
    assert.ok(content.includes('postgres:'), 'Must define postgres service');
    assert.ok(content.includes('redis:'), 'Must define redis service');

    // Container naming convention
    assert.ok(
      content.includes('container_name: stackstorm_postgres'),
      'Postgres container must be stackstorm_postgres'
    );
    assert.ok(
      content.includes('container_name: stackstorm_redis'),
      'Redis container must be stackstorm_redis'
    );

    // Specific alpine image versions
    assert.ok(content.includes('postgres:17-alpine'), 'Postgres must use postgres:17-alpine image');
    assert.ok(content.includes('redis:7-alpine'), 'Redis must use redis:7-alpine image');

    // Port mappings
    assert.ok(
      content.includes('5432:5432') || content.includes('DB_PORT:-5432}:5432'),
      'Port 5432 must be mapped'
    );
    assert.ok(
      content.includes('6379:6379') || content.includes('REDIS_PORT:-6379}:6379'),
      'Port 6379 must be mapped'
    );

    // Healthchecks
    assert.ok(content.includes('pg_isready'), 'Postgres must include pg_isready healthcheck');
    assert.ok(
      content.includes('redis-cli') && content.includes('ping'),
      'Redis must include redis-cli ping healthcheck'
    );

    // Persistent volume mappings
    assert.ok(content.includes('postgres_data:'), 'Must define persistent postgres_data volume');
    assert.ok(content.includes('redis_data:'), 'Must define persistent redis_data volume');

    // Initialization script mount
    assert.ok(
      content.includes('/docker-entrypoint-initdb.d/init-db.sh'),
      'Must mount init-db.sh script'
    );
  });

  it('should have a comprehensive .env.example with required database and redis variables', () => {
    const envExamplePath = path.join(ROOT_DIR, '.env.example');
    assert.ok(fs.existsSync(envExamplePath), '.env.example must exist in root');

    const content = fs.readFileSync(envExamplePath, 'utf-8');
    const requiredKeys = [
      'DB_HOST=localhost',
      'DB_PORT=5432',
      'DB_NAME=stackstorm_dev',
      'DB_USER=postgres',
      'DB_PASSWORD=postgres',
      'REDIS_HOST=localhost',
      'REDIS_PORT=6379',
      'REDIS_PASSWORD=',
    ];

    for (const key of requiredKeys) {
      assert.ok(content.includes(key), `.env.example must specify "${key}"`);
    }
  });

  it('should have a valid PostgreSQL init-db.sh script provisioning test database', () => {
    const scriptPath = path.join(ROOT_DIR, 'scripts', 'init-db.sh');
    assert.ok(fs.existsSync(scriptPath), 'scripts/init-db.sh must exist');

    const content = fs.readFileSync(scriptPath, 'utf-8');
    assert.ok(
      content.includes('stackstorm_test'),
      'init-db.sh must provision stackstorm_test database'
    );
    assert.ok(content.includes('psql'), 'init-db.sh must invoke psql');
  });
});
