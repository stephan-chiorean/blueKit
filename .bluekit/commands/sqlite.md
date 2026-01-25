# SQLite Database Commands

Database location: `~/.bluekit/bluekit.db`

## Quick Access

```bash
# Open database in interactive mode
sqlite3 ~/.bluekit/bluekit.db
```

## General Commands

```bash
# List all tables
.tables

# Show table schema
.schema projects
.schema checkpoints
.schema tasks
.schema library_workspaces
.schema library_artifacts

# Enable nice formatting
.mode column
.headers on

# Exit
.quit
```

## Projects Table

```sql
-- View all projects
SELECT * FROM projects;

-- Count total projects
SELECT COUNT(*) FROM projects;

-- Show projects with git status
SELECT id, name, git_connected, git_url, git_branch
FROM projects;

-- Show only git-connected projects
SELECT name, git_url, git_branch, last_commit_sha
FROM projects
WHERE git_connected = 1;

-- Show projects not connected to git
SELECT name, path
FROM projects
WHERE git_connected = 0;

-- Find a specific project by name
SELECT * FROM projects WHERE name LIKE '%blueKit%';

-- Show projects ordered by last opened
SELECT name, datetime(last_opened_at/1000, 'unixepoch') as last_opened
FROM projects
WHERE last_opened_at IS NOT NULL
ORDER BY last_opened_at DESC;

-- Show projects ordered by creation date
SELECT name, datetime(created_at/1000, 'unixepoch') as created
FROM projects
ORDER BY created_at DESC;
```

## Checkpoints Table

```sql
-- View all checkpoints
SELECT * FROM checkpoints;

-- Count checkpoints
SELECT COUNT(*) FROM checkpoints;

-- Show checkpoint summary
SELECT name, checkpoint_type, git_url, git_branch
FROM checkpoints;

-- Group checkpoints by type
SELECT checkpoint_type, COUNT(*) as count
FROM checkpoints
GROUP BY checkpoint_type;

-- Show checkpoints for a specific project
SELECT c.name, c.checkpoint_type, c.git_commit_sha, c.git_branch
FROM checkpoints c
WHERE c.project_id = 'your-project-id';

-- Show checkpoints ordered by creation date
SELECT name, checkpoint_type, datetime(created_at/1000, 'unixepoch') as created
FROM checkpoints
ORDER BY created_at DESC;

-- Find checkpoints by git URL
SELECT name, checkpoint_type, git_commit_sha, git_branch
FROM checkpoints
WHERE git_url LIKE '%blueKit%';
```

## Tasks Table

```sql
-- View all tasks
SELECT * FROM tasks;

-- Count tasks by status
SELECT status, COUNT(*) as count
FROM tasks
GROUP BY status;

-- Show high priority tasks
SELECT title, status, priority, complexity
FROM tasks
WHERE priority = 'high'
ORDER BY created_at DESC;

-- Show tasks for a specific project
SELECT t.title, t.status, t.priority
FROM tasks t
JOIN task_projects tp ON t.id = tp.task_id
WHERE tp.project_id = 'your-project-id';
```

## Library Tables

```sql
-- View library workspaces
SELECT * FROM library_workspaces;

-- View library artifacts
SELECT * FROM library_artifacts;

-- Show artifacts in a workspace
SELECT la.name, la.artifact_type, la.source_path
FROM library_artifacts la
WHERE la.workspace_id = 'your-workspace-id';
```

## Advanced Queries

```sql
-- Show projects with their checkpoint count
SELECT p.name, COUNT(c.id) as checkpoint_count
FROM projects p
LEFT JOIN checkpoints c ON p.id = c.project_id
GROUP BY p.id, p.name
ORDER BY checkpoint_count DESC;

-- Show git-connected projects with their latest commit
SELECT name, git_url, git_branch,
       SUBSTR(last_commit_sha, 1, 7) as short_sha,
       datetime(last_synced_at/1000, 'unixepoch') as last_synced
FROM projects
WHERE git_connected = 1;

-- Show all checkpoints with their parent relationships
SELECT c.name, c.checkpoint_type,
       p.name as parent_checkpoint
FROM checkpoints c
LEFT JOIN checkpoints p ON c.parent_checkpoint_id = p.id
ORDER BY c.created_at DESC;
```

## Database Maintenance

```sql
-- Check database integrity
PRAGMA integrity_check;

-- Show database size info
.dbinfo

-- Vacuum database (compact and optimize)
VACUUM;

-- Analyze database (update query optimizer statistics)
ANALYZE;
```

## Backup and Export

```bash
# Backup database
cp ~/.bluekit/bluekit.db ~/.bluekit/bluekit.db.backup

# Export table to CSV
sqlite3 -header -csv ~/.bluekit/bluekit.db "SELECT * FROM projects;" > projects.csv

# Export entire database to SQL
sqlite3 ~/.bluekit/bluekit.db .dump > database_backup.sql

# Import from SQL dump
sqlite3 ~/.bluekit/bluekit_restored.db < database_backup.sql
```

## Useful One-Liners

```bash
# Count all projects
sqlite3 ~/.bluekit/bluekit.db "SELECT COUNT(*) FROM projects;"

# List project names
sqlite3 ~/.bluekit/bluekit.db "SELECT name FROM projects;"

# Show git-connected projects
sqlite3 -header -column ~/.bluekit/bluekit.db "SELECT name, git_connected FROM projects WHERE git_connected = 1;"

# Count checkpoints by type
sqlite3 -header -column ~/.bluekit/bluekit.db "SELECT checkpoint_type, COUNT(*) FROM checkpoints GROUP BY checkpoint_type;"

# Show most recently created projects
sqlite3 -header -column ~/.bluekit/bluekit.db "SELECT name, datetime(created_at/1000, 'unixepoch') as created FROM projects ORDER BY created_at DESC LIMIT 5;"
```

## Timestamp Conversion

All timestamps in the database are stored as i64 Unix milliseconds. To convert them:

```sql
-- Convert milliseconds to readable datetime
SELECT name,
       datetime(created_at/1000, 'unixepoch') as created,
       datetime(updated_at/1000, 'unixepoch') as updated
FROM projects;

-- Convert datetime to milliseconds (for inserting)
SELECT (julianday('2024-12-14 10:30:00') - 2440587.5) * 86400000;
```

## Migration Verification

```bash
# Check if migration completed successfully
sqlite3 ~/.bluekit/bluekit.db "SELECT COUNT(*) as project_count FROM projects;"
sqlite3 ~/.bluekit/bluekit.db "SELECT COUNT(*) as checkpoint_count FROM checkpoints;"

# Compare with backup
cat ~/.bluekit/projectRegistry.json.backup | grep -c '"id"'

# Show migration backup files
ls -lh ~/.bluekit/*.backup
```

## Library Configuration

### Check Library Status
Query the local database to see current Library (Vault) configuration:
```bash
sqlite3 ~/.bluekit/bluekit.db "SELECT name, path, is_vault FROM projects WHERE is_vault = 1;"
```

### Reset Library
Delete the library project from the database to trigger setup screen again:
```bash
sqlite3 ~/.bluekit/bluekit.db "DELETE FROM projects WHERE is_vault = 1;"
```

### Wipe Database
Completely remove the database:
```bash
rm ~/.bluekit/bluekit.db
```
