-- Rust Strength — the "timed" load type, for holds like planks and wall sits.
--
-- On its own because Postgres will not let a new enum value be used in the
-- same transaction that adds it, and the SQL editor runs a whole script as one
-- transaction. Run this first, then 0013.
--
-- Safe to re-run.

alter type exercise_load_type add value if not exists 'timed';
