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
      <BookingWizard />
      <div className="mx-auto mt-4 max-w-3xl px-6 pb-24">
        <GoogleAppointmentSchedule />
      </div>
    </>
  );
}
