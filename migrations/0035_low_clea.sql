-- Display credit now comes from `owner_user_id` alone.
--
-- The free-text `author` column sat beside the owner relation and could name
-- someone who did not run the method — two answers to one question. Both live
-- methods carry an owner, so nothing loses its attribution.
ALTER TABLE "investment_methods" DROP COLUMN "author";
