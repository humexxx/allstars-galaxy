-- Superseded by method_allocations + transaction_allocations.
--
-- Safe to drop outright: it held hand-entered quantities, was added earlier
-- the same day, and was verified to contain zero rows before this ran. Keeping
-- it would leave two competing sources of truth for the same position.
DROP TABLE "method_holdings" CASCADE;
