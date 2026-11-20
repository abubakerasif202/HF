"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCustomerAction } from "../actions";
import { AdminAlert } from "../../../_components/ui";

export function CustomerEditForm({ customer }: { customer: { id: string; name: string; email: string; phone: string | null } }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  function submit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await updateCustomerAction({
        id: customer.id,
        name: String(formData.get("name") ?? ""),
        email: String(formData.get("email") ?? ""),
        phone: String(formData.get("phone") ?? ""),
      }).catch(() => ({ error: "Could not save. Try again." }) as const);
      if ("error" in result) {
        setMessage({ tone: "error", text: result.error });
        return;
      }
      setMessage({ tone: "success", text: result.warning ?? (result.changed ? "Customer details saved." : "No changes to save.") });
      router.refresh();
    });
  }

  return (
    <form className="a-cust-form" action={submit} noValidate>
      <label className="admin-field"><span className="admin-label">Name</span>
        <input className="admin-input" name="name" defaultValue={customer.name} maxLength={200} required autoComplete="off" /></label>
      <label className="admin-field"><span className="admin-label">Email</span>
        <input className="admin-input" name="email" type="email" defaultValue={customer.email} maxLength={254} required autoComplete="off" /></label>
      <label className="admin-field"><span className="admin-label">Phone</span>
        <input className="admin-input" name="phone" type="tel" defaultValue={customer.phone ?? ""} maxLength={40} autoComplete="off" /></label>
      <div className="a-cust-form-actions">
        <button type="submit" className="admin-btn admin-btn--primary" disabled={pending}>{pending ? "Saving…" : "Save details"}</button>
      </div>
      {message && <AdminAlert tone={message.tone}>{message.text}</AdminAlert>}
      <p className="a-cust-note">Changes are recorded in the audit trail. Issued invoices keep the customer details they were issued with.</p>
    </form>
  );
}
