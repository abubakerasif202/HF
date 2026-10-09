import { AdminCard, AdminDataList, AdminDataRow, formatAdelaide, formatMoney } from "../../../_components/ui";
import { Icon } from "../../../_components/Icon";
import { FinalizeJobForm } from "./FinalizeJobForm";

interface BillingBooking {
  id: string;
  booking_status: string;
  finalised_at: string | null;
  actual_duration_minutes: number | null;
  billable_duration_minutes: number | null;
  service_charge_cents: number | null;
  callout_fee_cents: number | null;
  final_total_cents: number | null;
  balance_due_cents: number;
}

export function BillingCard({ booking, hadAdvancePayment, paidBeforeJobCents }: { booking: BillingBooking; hadAdvancePayment: boolean; paidBeforeJobCents: number }) {
  return (
    <AdminCard
      icon="dollar"
      title="Final job billing"
      description={
        hadAdvancePayment
          ? "3-hour minimum service plus a separate 1-hour call-out. The booking confirmation this customer actually paid is deducted once from the total."
          : "3-hour minimum service plus a separate 1-hour call-out. No advance payment was taken, so the balance is the full final total."
      }
    >
      {booking.finalised_at ? (
        <div>
          <div className="admin-billing-parts">
            <div className="admin-billing-part">
              <p className="admin-billing-part-title"><Icon name="clock" size={15} />Service time</p>
              <AdminDataList>
                <AdminDataRow label="Actual service time" value={`${booking.actual_duration_minutes} min`} />
                <AdminDataRow label="Billable service time" value={`${booking.billable_duration_minutes} min`} />
                <AdminDataRow label="Service charge" value={formatMoney(booking.service_charge_cents)} tone="strong" />
              </AdminDataList>
            </div>
            <div className="admin-billing-part">
              <p className="admin-billing-part-title"><Icon name="truck" size={15} />Call-out</p>
              <AdminDataList>
                <AdminDataRow label="Call-out (1 hour)" value={formatMoney(booking.callout_fee_cents)} tone="strong" />
              </AdminDataList>
              <div className="admin-help mt-1">Truck fuel + basic transport included.</div>
            </div>
          </div>
          <div className="admin-billing-summary">
            <AdminDataList>
              <AdminDataRow className="admin-billing-total" label="Final total" value={formatMoney(booking.final_total_cents)} />
              {paidBeforeJobCents > 0 ? (
                <AdminDataRow label="Booking confirmation paid" value={`−${formatMoney(paidBeforeJobCents)}`} tone="green" />
              ) : (
                <AdminDataRow label="Paid before move" value={`${formatMoney(0)} — advance payment not required`} />
              )}
              <AdminDataRow className="admin-billing-balance" label="Balance remaining" value={formatMoney(booking.balance_due_cents)} />
            </AdminDataList>
          </div>
          <div className="admin-help mt-3">Finalised {formatAdelaide(booking.finalised_at)}</div>
        </div>
      ) : (
        <FinalizeJobForm bookingId={booking.id} bookingStatus={booking.booking_status} />
      )}
    </AdminCard>
  );
}
