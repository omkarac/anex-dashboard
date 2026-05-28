import { Resend } from 'resend';
import type { ActionResult } from '@/lib/actions/_base';

let cached: Resend | null = null;

function getResend(): Resend {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not configured');
  cached = new Resend(key);
  return cached;
}

export type SendEmailInput = {
  to: string[];
  subject: string;
  html: string;
  // Optional plain-text fallback for clients that block HTML.
  text?: string;
};

export async function sendEmail(input: SendEmailInput): Promise<ActionResult<{ id: string }>> {
  const from = process.env.EMAIL_FROM;
  if (!from) return { ok: false, error: 'EMAIL_FROM is not configured' };
  if (input.to.length === 0) return { ok: false, error: 'No recipients' };

  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: 'Resend returned no message id' };
    return { ok: true, data: { id: data.id } };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Resend send failed';
    return { ok: false, error: message };
  }
}
