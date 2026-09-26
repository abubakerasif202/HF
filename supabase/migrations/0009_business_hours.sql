-- Confirmed booking policy: earliest booking start 5am, last booking
-- start 6pm (see lib/booking/availability.ts for how "last booking start"
-- differs from "business closes at" — the job may run later than close).
update business_settings set business_open_time = '05:00', business_close_time = '18:00' where id = true;
