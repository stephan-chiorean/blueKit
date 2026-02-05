---
id: postgres-database-migrations
alias: PostgreSQL Database Migrations
type: kit
is_base: false
version: 1
tags:
  - postgresql
  - migrations
  - database
description: A reusable kit for implementing PostgreSQL database migrations with safe patterns for creating tables, adding columns, creating indexes, and managing schema changes
---
# PostgreSQL Database Migrations Kit

A comprehensive, reusable kit for implementing PostgreSQL database migrations. This kit provides safe patterns, code templates, and best practices for managing schema changes in PostgreSQL databases.

## Overview

This kit provides:
- Safe migration patterns for PostgreSQL
- Templates for common operations (tables, columns, indexes)
- Best practices for idempotent migrations
- Error handling patterns
- Rollback strategies

## Migration File Structure

Create migration files with timestamps and descriptive names:

```
migrations/
  001_create_users_table.sql
  002_add_email_to_users.sql
  003_create_posts_table.sql
  004_add_indexes.sql
```

## Pattern 1: Creating Tables Safely

Use `CREATE TABLE IF NOT EXISTS` for idempotent table creation:

```sql
-- Migration: Create {{TABLE_NAME}} table
CREATE TABLE IF NOT EXISTS {{TABLE_NAME}} (
    id {{ID_TYPE}} PRIMARY KEY {{ID_GENERATION}},
    {{COLUMN_DEFINITIONS}},
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add comment for documentation
COMMENT ON TABLE {{TABLE_NAME}} IS '{{TABLE_DESCRIPTION}}';
```

**Example:**
```sql
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE users IS 'User accounts table';
```

## Pattern 2: Adding Columns Safely

PostgreSQL doesn't support `ADD COLUMN IF NOT EXISTS`, so check first:

```sql
-- Migration: Add {{COLUMN_NAME}} to {{TABLE_NAME}}
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = '{{TABLE_NAME}}' 
        AND column_name = '{{COLUMN_NAME}}'
    ) THEN
        ALTER TABLE {{TABLE_NAME}} 
        ADD COLUMN {{COLUMN_NAME}} {{COLUMN_TYPE}} {{DEFAULT_VALUE}} {{NULL_CONSTRAINT}};
        
        COMMENT ON COLUMN {{TABLE_NAME}}.{{COLUMN_NAME}} IS '{{COLUMN_DESCRIPTION}}';
    END IF;
END $$;
```

**Example:**
```sql
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'active';
        
        COMMENT ON COLUMN users.status IS 'User account status';
    END IF;
END $$;
```

## Pattern 3: Creating Indexes

Create indexes with `IF NOT EXISTS` (PostgreSQL 9.5+):

```sql
-- Migration: Create index on {{TABLE_NAME}}.{{COLUMN_NAME}}
CREATE INDEX IF NOT EXISTS idx_{{TABLE_NAME}}_{{COLUMN_NAME}} 
ON {{TABLE_NAME}}({{COLUMN_NAME}});

-- For unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_{{TABLE_NAME}}_{{COLUMN_NAME}}_unique 
ON {{TABLE_NAME}}({{COLUMN_NAME}});

-- For composite indexes
CREATE INDEX IF NOT EXISTS idx_{{TABLE_NAME}}_{{COL1}}_{{COL2}} 
ON {{TABLE_NAME}}({{COLUMN1}}, {{COLUMN2}});
```

**Example:**
```sql
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email);
CREATE INDEX IF NOT EXISTS idx_posts_user_created ON posts(user_id, created_at);
```

## Pattern 4: Creating Foreign Keys

Add foreign key constraints safely:

```sql
-- Migration: Add foreign key from {{CHILD_TABLE}} to {{PARENT_TABLE}}
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_{{CHILD_TABLE}}_{{PARENT_TABLE}}'
    ) THEN
        ALTER TABLE {{CHILD_TABLE}}
        ADD CONSTRAINT fk_{{CHILD_TABLE}}_{{PARENT_TABLE}}
        FOREIGN KEY ({{FOREIGN_KEY_COLUMN}}) 
        REFERENCES {{PARENT_TABLE}}({{REFERENCED_COLUMN}})
        ON DELETE {{DELETE_ACTION}};
    END IF;
END $$;
```

**Example:**
```sql
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_posts_user_id'
    ) THEN
        ALTER TABLE posts
        ADD CONSTRAINT fk_posts_user_id
        FOREIGN KEY (user_id) 
        REFERENCES users(id)
        ON DELETE CASCADE;
    END IF;
END $$;
```

## Pattern 5: Creating Junction Tables

For many-to-many relationships:

```sql
-- Migration: Create junction table {{JUNCTION_TABLE}}
CREATE TABLE IF NOT EXISTS {{JUNCTION_TABLE}} (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    {{TABLE1}}_id {{ID_TYPE}} NOT NULL,
    {{TABLE2}}_id {{ID_TYPE}} NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE({{TABLE1}}_id, {{TABLE2}}_id)
);

-- Add foreign keys
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_{{JUNCTION_TABLE}}_{{TABLE1}}'
    ) THEN
        ALTER TABLE {{JUNCTION_TABLE}}
        ADD CONSTRAINT fk_{{JUNCTION_TABLE}}_{{TABLE1}}
        FOREIGN KEY ({{TABLE1}}_id) REFERENCES {{TABLE1}}(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_{{JUNCTION_TABLE}}_{{TABLE2}}'
    ) THEN
        ALTER TABLE {{JUNCTION_TABLE}}
        ADD CONSTRAINT fk_{{JUNCTION_TABLE}}_{{TABLE2}}
        FOREIGN KEY ({{TABLE2}}_id) REFERENCES {{TABLE2}}(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_{{JUNCTION_TABLE}}_{{TABLE1}}_id 
ON {{JUNCTION_TABLE}}({{TABLE1}}_id);
CREATE INDEX IF NOT EXISTS idx_{{JUNCTION_TABLE}}_{{TABLE2}}_id 
ON {{JUNCTION_TABLE}}({{TABLE2}}_id);
```

## Pattern 6: Modifying Column Types

Safely alter column types (be careful with existing data):

```sql
-- Migration: Change {{COLUMN_NAME}} type in {{TABLE_NAME}}
DO $$
BEGIN
    -- Check if column exists and type is different
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = '{{TABLE_NAME}}' 
        AND column_name = '{{COLUMN_NAME}}'
        AND data_type != '{{NEW_TYPE}}'
    ) THEN
        -- For safe type changes, you may need to convert data
        ALTER TABLE {{TABLE_NAME}}
        ALTER COLUMN {{COLUMN_NAME}} TYPE {{NEW_TYPE}}
        USING {{COLUMN_NAME}}::{{NEW_TYPE}};
    END IF;
END $$;
```

**Example:**
```sql
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'age'
        AND data_type != 'integer'
    ) THEN
        ALTER TABLE users
        ALTER COLUMN age TYPE INTEGER
        USING age::INTEGER;
    END IF;
END $$;
```

## Pattern 7: Adding Constraints

Add check constraints, unique constraints, etc.:

```sql
-- Migration: Add constraint to {{TABLE_NAME}}
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = '{{CONSTRAINT_NAME}}'
    ) THEN
        ALTER TABLE {{TABLE_NAME}}
        ADD CONSTRAINT {{CONSTRAINT_NAME}} {{CONSTRAINT_DEFINITION}};
    END IF;
END $$;
```

**Examples:**
```sql
-- Check constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'users_email_format'
    ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_email_format 
        CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
    END IF;
END $$;

-- Unique constraint (alternative to unique index)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'users_username_unique'
    ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_username_unique UNIQUE (username);
    END IF;
END $$;
```

## Pattern 8: Migration Runner Script

Example migration runner in your application language:

**Rust (using tokio-postgres):**
```rust
use tokio_postgres::{Client, NoTls};

async fn run_migration(client: &Client, migration_sql: &str) -> Result<(), Box<dyn std::error::Error>> {
    let transaction = client.transaction().await?;
    
    transaction.batch_execute(migration_sql).await?;
    transaction.commit().await?;
    
    Ok(())
}
```

**Node.js (using pg):**
```javascript
async function runMigration(client, migrationSQL) {
    await client.query('BEGIN');
    try {
        await client.query(migrationSQL);
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
}
```

**Python (using psycopg2):**
```python
def run_migration(conn, migration_sql):
    with conn.cursor() as cur:
        conn.autocommit = False
        try:
            cur.execute(migration_sql)
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
```

## Pattern 9: Migration Tracking Table

Track which migrations have been applied:

```sql
-- Create migration tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(255) PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Function to check if migration was applied
CREATE OR REPLACE FUNCTION migration_applied(version_name VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM schema_migrations WHERE version = version_name
    );
END;
$$ LANGUAGE plpgsql;

-- Mark migration as applied
INSERT INTO schema_migrations (version) 
VALUES ('{{MIGRATION_VERSION}}')
ON CONFLICT (version) DO NOTHING;
```

## Best Practices

1. **Always use transactions**: Wrap migrations in transactions for atomicity
2. **Check before altering**: Use `DO $$` blocks to check existence before modifying
3. **Use IF NOT EXISTS**: For tables and indexes when supported
4. **Add comments**: Document tables and columns with `COMMENT ON`
5. **Version migrations**: Use timestamps or sequential numbers
6. **Test on existing data**: Always test migrations on databases with existing data
7. **Provide defaults**: For `NOT NULL` columns, always provide `DEFAULT` values
8. **Index foreign keys**: Create indexes on foreign key columns for performance
9. **Use appropriate types**: Choose the right PostgreSQL types (UUID, TIMESTAMP, etc.)
10. **Handle rollbacks**: Consider how to rollback if needed (separate rollback scripts)

## Common PostgreSQL Types

- **IDs**: `UUID` (with `gen_random_uuid()`) or `SERIAL`/`BIGSERIAL`
- **Text**: `VARCHAR(n)`, `TEXT`, `CHAR(n)`
- **Numbers**: `INTEGER`, `BIGINT`, `DECIMAL(p,s)`, `NUMERIC(p,s)`
- **Booleans**: `BOOLEAN`
- **Dates**: `TIMESTAMP`, `TIMESTAMPTZ`, `DATE`, `TIME`
- **JSON**: `JSON`, `JSONB` (preferred for querying)
- **Arrays**: `TEXT[]`, `INTEGER[]`, etc.

## Handling Reserved Keywords

PostgreSQL has reserved keywords (like `type`, `user`, `order`, etc.). When creating columns with reserved keywords:

**Option 1: Use quotes (not recommended for column names)**
```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY,
    "type" VARCHAR(50)  -- Quoted, but makes queries awkward
);
```

**Option 2: Use descriptive names (recommended)**
```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY,
    task_type VARCHAR(50)  -- ✅ Clear and avoids conflicts
);
```

**Option 3: Use underscore suffix (if you must match application naming)**
```sql
CREATE TABLE tasks (
    id UUID PRIMARY KEY,
    type_ VARCHAR(50)  -- ✅ Works, but less readable
);
```

**Best Practice**: Use descriptive, non-reserved names like `task_type`, `user_role`, `order_status` instead of `type`, `user`, `order`.

## Rollback Patterns

For reversible migrations, create separate rollback scripts:

```sql
-- Rollback: Remove {{COLUMN_NAME}} from {{TABLE_NAME}}
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = '{{TABLE_NAME}}' 
        AND column_name = '{{COLUMN_NAME}}'
    ) THEN
        ALTER TABLE {{TABLE_NAME}} DROP COLUMN {{COLUMN_NAME}};
    END IF;
END $$;
```

## Migration Checklist

- [ ] Migration is idempotent (safe to run multiple times)
- [ ] Uses transactions for atomicity
- [ ] Checks existence before altering (for columns, constraints, etc.)
- [ ] Includes appropriate indexes
- [ ] Handles existing data gracefully
- [ ] Includes comments/documentation
- [ ] Avoids reserved keywords in column names (use descriptive names)
- [ ] Tested on fresh database
- [ ] Tested on database with existing data
- [ ] Rollback script created (if needed)
- [ ] Migration version tracked

## Example: Complete Migration

```sql
-- Migration: 001_create_users_and_posts.sql

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE users IS 'User accounts';

-- Create unique index on email
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique ON users(username);

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE posts IS 'User blog posts';

-- Add foreign key
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_posts_user_id'
    ) THEN
        ALTER TABLE posts
        ADD CONSTRAINT fk_posts_user_id
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);

-- Track migration
INSERT INTO schema_migrations (version) 
VALUES ('001_create_users_and_posts')
ON CONFLICT (version) DO NOTHING;
```

## Usage

Replace the tokens ({{TOKEN_NAME}}) with your actual values:
- `{{TABLE_NAME}}` → your table name
- `{{COLUMN_NAME}}` → your column name
- `{{COLUMN_TYPE}}` → PostgreSQL data type
- `{{ID_TYPE}}` → UUID, SERIAL, etc.
- And so on...

This kit provides all the patterns you need for safe, reusable PostgreSQL migrations.
