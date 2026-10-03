import { Resend } from "resend";

import { env } from "@/config/env";

let resendClient: Resend | null = null;

function isMailerConfigured() {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

function getClient() {
  if (!resendClient) {
    resendClient = new Resend(env.RESEND_API_KEY);
  }
  return resendClient;
}

export async function sendEmail(input: { to: string; subject: string; html: string }) {
  if (!isMailerConfigured()) {
    console.warn(`[mailer] Resend is not configured; skipping email "${input.subject}" to ${input.to}.`);
    return;
  }

  const { error } = await getClient().emails.send({
    from: env.EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });

  if (error) {
    console.error(`[mailer] Failed to send email "${input.subject}" to ${input.to}: ${error.message}`);
  }
}
