import type { Metadata } from "next";
import { Footer } from "../components/Site";
import { Header, UtilityBar } from "../components/SiteClient";
import { JobCompletionForm } from "./JobCompletionForm";

export const metadata: Metadata = { title: "Job Completion Form", description: "Review and sign your HF Removals Adelaide job completion record.", robots: { index: false, follow: true } };

export default function JobCompletionPage() {
  return <><UtilityBar /><Header /><main id="main" className="job-completion-page"><section className="job-hero"><div className="container"><p className="eyebrow">HF Removals Adelaide · Service close-out</p><h1>Job Completion <em>Form</em></h1><p>Please review the job details and terms below, confirm completion of the service, and sign before our removal team leaves.</p></div></section><div className="container job-form-container"><JobCompletionForm /></div></main><Footer /></>;
}
