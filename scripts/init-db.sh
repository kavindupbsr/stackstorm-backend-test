#!/bin/bash
set -e

echo "Starting StackStorm PostgreSQL Database Initialization..."

# Check and create the test database if it does not already exist
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE stackstorm_test'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'stackstorm_test')\gexec
    GRANT ALL PRIVILEGES ON DATABASE stackstorm_test TO "$POSTGRES_USER";
EOSQL

echo "StackStorm Databases (stackstorm_dev & stackstorm_test) initialized successfully."
