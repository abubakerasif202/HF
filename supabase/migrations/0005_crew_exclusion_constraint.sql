-- Found during database-level double-booking verification: the schema had
-- an EXCLUDE constraint preventing two live bookings from sharing the same
-- vehicle and overlapping time range, but nothing equivalent for crew_id —
-- so the same crew could be assigned to two overlapping jobs. Mirrors the
-- vehicle constraint exactly, including the same "live statuses" predicate
-- so cancelled/expired bookings don't block a crew forever.
alter table bookings
  add constraint bookings_no_double_crew_booking
  exclude using gist (
    crew_id with =,
    tstzrange(starts_at, ends_at) with &&
  )
  where (
    crew_id is not null
    and booking_status in ('held', 'pending_payment', 'confirmed', 'assigned', 'in_progress')
  );
