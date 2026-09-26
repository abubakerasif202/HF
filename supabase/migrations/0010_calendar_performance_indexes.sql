-- Performance indexes for the new /admin/calendar range queries (and the
-- existing availability/hold-conflict lookups, which use the same
-- "lt end_range, gt start_range" overlap pattern). Found missing during
-- this pass: bookings had a btree index on vehicle_id but none on
-- crew_id, and no range index to accelerate the overlap predicate itself
-- (previously relying on the starts_at btree index alone, which is
-- serviceable but not ideal for a range-overlap scan as the table grows).

create index if not exists bookings_crew_idx on bookings (crew_id);

-- GiST index on the same tstzrange expression the EXCLUDE constraints and
-- every overlap query (`lt end, gt start`) already use.
create index if not exists bookings_range_idx on bookings using gist (tstzrange(starts_at, ends_at));
