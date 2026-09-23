-- Persist event quote particulars (dinner, rooms, conference, lunch) on bookings.
ALTER TABLE "event_bookings" ADD COLUMN "details" TEXT;
