// No-advance-payment booking confirmation, as pure orchestration over
// injected dependencies so it is unit-testable without a database. The
// database RPC `confirm_booking_without_payment` (migration 0011) is the
// authority: it validates the access token, the `held` state and the
// hold expiry inside ONE conditional UPDATE, and reports `transitioned`
// only to the single caller that actually flipped the row. Everything
// here keys off that flag, so a double-clicked Confirm Booking can never
// send two emails or create two calendar events.

export type ConfirmReason = "confirmed" | "already_confirmed" | "hold_expired" | "not_found" | "invalid_status";

export interface ConfirmRpcResult<B> {
  transitioned: boolean;
  reason: ConfirmReason;
  booking: B | null;
}

export interface ConfirmDeps<B> {
  confirm: () => Promise<ConfirmRpcResult<B>>;
  sendConfirmationEmail: (booking: B) => Promise<void>;
  syncCalendar: (booking: B) => Promise<void>;
  onSideEffectError?: (what: "email" | "calendar", error: unknown) => void;
}

export interface ConfirmOutcome<B> {
  httpStatus: number;
  reason: ConfirmReason;
  booking: B | null;
  message?: string;
}

export const HOLD_EXPIRED_MESSAGE = "Your selected time is no longer being held. Please choose an available time again.";

const FAILURE_RESPONSES: Record<Exclude<ConfirmReason, "confirmed" | "already_confirmed">, { httpStatus: number; message: string }> = {
  hold_expired: { httpStatus: 409, message: HOLD_EXPIRED_MESSAGE },
  not_found: { httpStatus: 404, message: "Booking not found." },
  invalid_status: { httpStatus: 409, message: "This booking can no longer be confirmed online. Please start a new booking or contact us." },
};

export async function runNoPaymentConfirmation<B>(deps: ConfirmDeps<B>): Promise<ConfirmOutcome<B>> {
  const result = await deps.confirm();

  if (result.reason === "confirmed" || result.reason === "already_confirmed") {
    if (result.transitioned && result.booking) {
      // External side effects run only after the authoritative DB write,
      // and their failure never un-confirms the booking.
      await deps.sendConfirmationEmail(result.booking).catch((error) => deps.onSideEffectError?.("email", error));
      await deps.syncCalendar(result.booking).catch((error) => deps.onSideEffectError?.("calendar", error));
    }
    return { httpStatus: 200, reason: result.reason, booking: result.booking };
  }

  const failure = FAILURE_RESPONSES[result.reason] ?? FAILURE_RESPONSES.invalid_status;
  return { httpStatus: failure.httpStatus, reason: result.reason, booking: null, message: failure.message };
}
