"use server";

import { revalidatePath } from "next/cache";
import { getStaffSession } from "../../../../lib/server/supabase-ssr.ts";
import { customerChanges, customerEditSchema, type CustomerEditInput } from "../../../../lib/customers.ts";
import { findOtherCustomerWithEmail, getCustomerRecord, updateCustomerRecord, writeAdminAudit } from "../../../../lib/server/customer-repo.ts";

export type UpdateCustomerResult = { ok: true; changed: boolean; warning?: string } | { error: string };

async function requireStaff() {
  const session = await getStaffSession();
  if (!session) throw new Error("Not authorized");
  return session;
}

/** Owner-only edit of a customer's name, email and phone. Writes an admin_audit row for every real change. */
export async function updateCustomerAction(input: CustomerEditInput): Promise<UpdateCustomerResult> {
  const staff = await requireStaff();
  const parsed = customerEditSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Some details are invalid." };
  const data = parsed.data;
  try {
    const existing = await getCustomerRecord(data.id);
    if (!existing) return { error: "Customer not found." };
    const changes = customerChanges(existing, data);
    if (!changes) return { ok: true, changed: false };
    if (changes.after.email != null && (await findOtherCustomerWithEmail(data.email, data.id))) {
      return { error: "Another customer already uses that email address." };
    }
    await updateCustomerRecord(data.id, { name: data.name, email: data.email, phone: data.phone });
    const audited = await writeAdminAudit({
      actor: staff.userId, action: "customer.update", entityType: "customer", entityId: data.id, before: changes.before, after: changes.after,
    });
    revalidatePath("/admin/customers");
    revalidatePath(`/admin/customers/${data.id}`);
    return audited ? { ok: true, changed: true } : { ok: true, changed: true, warning: "Saved, but the audit entry could not be written. Check that migration 0022 has been applied." };
  } catch {
    return { error: "Customer details are temporarily unavailable. Try again." };
  }
}
