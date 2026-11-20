/** Plain download link to an owner-guarded CSV export route (the browser sends the admin session cookie). */
export function ExportCsvLink({ href, label = "Export CSV" }: { href: string; label?: string }) {
  return (
    <a href={href} download className="admin-btn admin-btn--secondary" aria-label={`${label} (downloads a file)`}>
      {label}
    </a>
  );
}
