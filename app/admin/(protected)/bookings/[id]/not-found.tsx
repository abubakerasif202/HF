import Link from "next/link";

export default function BookingNotFound() {
  return (
    <section className="admin-card">
      <h1>Booking unavailable</h1>
      <p>We couldn’t find a booking at this address.</p>
      <Link href="/admin/bookings" className="admin-link">Back to Bookings</Link>
    </section>
  );
}
