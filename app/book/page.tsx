import type { Metadata } from "next";
import Link from "next/link";
import { isBookingSystemLive } from "../../lib/server/config.ts";
import { BookingWizard } from "./BookingWizard";
import { GoogleAppointmentSchedule } from "../components/GoogleAppointmentSchedule";
import { business } from "../../lib/site-data";

export const metadata: Metadata = {
  title: "Book Your Move | " + business.name,
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function BookPage() {
  if (!isBookingSystemLive()) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold">Online booking is coming soon</h1>
        <p className="mt-4 text-neutral-600">
          Our instant booking system is being switched on. In the meantime, tell us about your move and
          we&apos;ll get back to you with a quote.
        </p>
        <Link href="/contact" className="mt-8 inline-block rounded-full bg-neutral-900 px-6 py-3 text-white">
          Get a Quote
        </Link>
      </main>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-3xl px-6 pt-16 pb-4 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-400">Book Your Move</p>
        <h1 className="mt-2 text-3xl font-semibold">Book your move online in a few easy steps</h1>
        <ol className="mx-auto mt-6 grid max-w-xl grid-cols-1 gap-2 text-left text-sm text-neutral-600 sm:grid-cols-2">
          <li>1. Enter your move details</li>
          <li>2. Choose an available time</li>
          <li>3. Pay $100 to secure the booking</li>
          <li>4. Receive your booking confirmation</li>
        </ol>
        <p className="mx-auto mt-6 max-w-xl text-xs text-neutral-500">
          Your $100 booking confirmation payment is credited toward your final balance. Final pricing is calculated
          after your move is completed. A 3-hour minimum service and a separate 1-hour call-out fee apply.
        </p>
      </div>
      <BookingWizard />
      <div className="mx-auto mt-4 max-w-3xl px-6 pb-24">
        <GoogleAppointmentSchedule />
      </div>
    </>
  );
}
