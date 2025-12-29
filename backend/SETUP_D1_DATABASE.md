# Setting Up D1 Database

Follow these steps to create and configure your D1 database:

## Step 1: Create the D1 Database

Run this command in your terminal (from the `backend` directory):

```bash
cd backend
wrangler d1 create job-hunting-db
```

This will output something like:
```
✅ Successfully created DB 'job-hunting-db'!

[[d1_databases]]
binding = "DB"
database_name = "job-hunting-db"
database_id = "abc123def456ghi789"  # <-- Copy this ID
```

## Step 2: Update wrangler.toml

Copy the `database_id` from the output above and paste it into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "job-hunting-db"
database_id = "your-database-id-here"  # <-- Paste the ID here
```

## Step 3: Run the Schema Migration

After updating the database_id, run the migration:

```bash
# For local development
wrangler d1 execute job-hunting-db --local --file=./database/d1-schema.sql

# For production (after deploying)
wrangler d1 execute job-hunting-db --file=./database/d1-schema.sql
```

## Step 4: Verify the Database

Test that the database is working:

```bash
# List databases
wrangler d1 list

# Test a query (local)
wrangler d1 execute job-hunting-db --local --command="SELECT name FROM sqlite_master WHERE type='table'"

# Test a query (production)
wrangler d1 execute job-hunting-db --command="SELECT name FROM sqlite_master WHERE type='table'"
```

## Troubleshooting

### Error: "Couldn't find a D1 DB with the name or binding 'job-hunting-db'"

This means:
1. The database hasn't been created yet (run Step 1)
2. OR the `database_id` in `wrangler.toml` is empty or incorrect (run Step 2)

### Error: "Permission denied" or "Network access blocked"

Make sure you:
1. Are logged into Cloudflare: `wrangler login`
2. Have the correct account selected: `wrangler whoami`
3. Have network access enabled

### Error: "Database not found"

Make sure the `database_name` in `wrangler.toml` matches exactly what you created.

## Alternative: Create via Cloudflare Dashboard

1. Go to https://dash.cloudflare.com
2. Navigate to **Workers & Pages** → **D1**
3. Click **Create database**
4. Name it: `job-hunting-db`
5. Copy the Database ID
6. Update `wrangler.toml` with the ID
7. Run the migration using the dashboard or CLI

