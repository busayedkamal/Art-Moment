const RESEND_EMAIL_ENDPOINT = 'https://api.resend.com/emails';

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  tags?: Array<{ name: string; value: string }>;
};

function getProviderError(result: unknown) {
  const payload = result && typeof result === 'object'
    ? result as Record<string, unknown>
    : {};
  const nested = payload.error && typeof payload.error === 'object'
    ? payload.error as Record<string, unknown>
    : {};

  return {
    name: String(payload.name || nested.name || ''),
    message: String(payload.message || nested.message || ''),
  };
}

function getEmailFailureCode(status: number, result: unknown) {
  const providerError = getProviderError(result);
  const message = `${providerError.name} ${providerError.message}`.toLowerCase();

  if (/only send testing emails to your own|testing emails to your own email/.test(message)) {
    return 'email_testing_recipient_restricted';
  }
  if (/domain.+not verified|not verified.+domain/.test(message)) {
    return 'email_sender_domain_not_verified';
  }
  if (/invalid api key|api key is invalid/.test(message)) {
    return 'email_api_key_invalid';
  }
  if (status === 429 || /rate.?limit|too many requests/.test(message)) {
    return 'email_rate_limited';
  }
  if (/invalid.+from|from.+invalid|sender.+invalid/.test(message)) {
    return 'email_sender_invalid';
  }
  if (/validation_error|validation error/.test(message)) {
    return 'email_validation_failed';
  }
  return 'email_send_failed';
}

export async function sendEmail({ to, subject, html, text, tags }: SendEmailInput) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM') || 'Art Moment <onboarding@resend.dev>';
  const replyTo = Deno.env.get('RESEND_REPLY_TO') || 'art.moment26@gmail.com';

  if (!apiKey) {
    throw new Error('email_api_key_missing');
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
      reply_to: replyTo || undefined,
    }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const failureCode = getEmailFailureCode(response.status, result);
    console.error('Resend email failed:', {
      status: response.status,
      failureCode,
      provider: getProviderError(result),
    });
    throw new Error(failureCode);
  }

  return result;
}
