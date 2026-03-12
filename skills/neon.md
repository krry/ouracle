# Neon Migration Notes

## Problem
`psql "$DATABASE_URL" -f api/migrations/002_add_conversation.sql` failed against Neon due to:
- `channel binding required` (libpq mismatch)
- `Endpoint ID is not specified` (SNI requirement)

## Working Command
Use a Neon URL with channel binding disabled **and** explicit endpoint option:

```
DATABASE_URL="postgresql://<user>:<pass>@<endpoint>-pooler.c-2.us-east-2.aws.neon.tech/<db>?channel_binding=disable&sslmode=require&options=endpoint%3D<endpoint>"
psql "$DATABASE_URL" -f api/migrations/002_add_conversation.sql
```

Example from this repo:

```
DATABASE_URL="postgresql://neondb_owner:***@ep-calm-river-aejy2z18-pooler.c-2.us-east-2.aws.neon.tech/neondb?channel_binding=disable&sslmode=require&options=endpoint%3Dep-calm-river-aejy2z18"
psql "$DATABASE_URL" -f api/migrations/002_add_conversation.sql
```

## Notes
- Sourcing `api/.env` failed because the URL contains `&` which breaks `source` in some shells; inline assignment avoids that.
- If you see `database "kerry" does not exist`, the env var wasn’t set for the `psql` process.
- The pooler hostname still requires the endpoint option for older libpq.
