import { Metadata } from 'next';
import Link from 'next/link';
import { RegisterCpForm } from './RegisterCpForm';

export const metadata: Metadata = { title: 'Register Channel Partner — Anex Sales' };

export default function RegisterCpPage() {
  return (
    <div style={{ padding: 'var(--content-pad)', maxWidth: 640, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, fontSize: 12, color: 'var(--sales-txt3)' }}>
        <Link href="/sales/channel-partners" style={{ color: 'var(--sales-txt3)', textDecoration: 'none' }}>
          Channel Partners
        </Link>
        <span>›</span>
        <span style={{ color: 'var(--sales-txt2)', fontWeight: 600 }}>Register New</span>
      </div>

      <div className="sales-card">
        <div className="sales-card-header">
          <div>
            <div className="sales-card-title">Register Channel Partner</div>
            <div className="sales-card-sub">Meeting Category auto-computed. Duplicate check runs on submit.</div>
          </div>
        </div>
        <div style={{ padding: '20px 20px 24px' }}>
          <RegisterCpForm />
        </div>
      </div>
    </div>
  );
}
