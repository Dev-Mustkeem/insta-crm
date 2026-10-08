WITH ranked_users AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "business_id"
      ORDER BY "created_at" ASC, "id" ASC
    ) AS user_rank
  FROM "users"
  WHERE "deleted_at" IS NULL
)
UPDATE "users"
SET "role" = 'SUPER_ADMIN'
FROM ranked_users
WHERE "users"."id" = ranked_users."id"
  AND ranked_users.user_rank = 1;
