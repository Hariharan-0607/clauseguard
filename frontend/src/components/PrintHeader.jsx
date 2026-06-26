// Rendered only when printing (see @media print in index.css).
// Gives the exported PDF a clean header + the standard disclaimer.
export default function PrintHeader({ title = '' }) {
  const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  return (
    <div className="print-only print-header">
      <div className="print-brand">ClauseGuard</div>
      {title && <div className="print-title">{title}</div>}
      <div className="print-meta">{today} · Not legal advice — for your specific case, consult a qualified lawyer or free legal aid.</div>
    </div>
  )
}
