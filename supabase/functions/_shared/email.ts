const RESEND_EMAIL_ENDPOINT = 'https://api.resend.com/emails';

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tags?: Array<{ name: string; value: string }>;
};

export async function sendEmail({ to, subject, html, text, tags }: SendEmailInput) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM') || 'Art Moment <onboarding@resend.dev>';

  if (!apiKey) {
    throw new Error('RESEND_API_KEY is missing.');
  }

  const response = await fetch(RESEND_EMAIL_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      text,
      tags,
    }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error('Resend email failed:', result);
    throw new Error('email_send_failed');
  }

  return result;
}
