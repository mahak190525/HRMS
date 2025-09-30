/*
  # Create net schema

  1. Schema Creation
    - Create the `net` schema that is required by some database functions
    - This schema is commonly used for network-related functions in PostgreSQL

  2. Purpose
    - Resolves the "schema 'net' does not exist" error
    - Enables proper functioning of database triggers and functions that reference this schema
*/

-- Create the net schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS net;

-- Grant usage permissions to authenticated users
GRANT USAGE ON SCHEMA net TO authenticated;
GRANT USAGE ON SCHEMA net TO service_role;