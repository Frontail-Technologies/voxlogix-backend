import nodemailer from "nodemailer";

import { env } from "@/config/env";

let transporter: nodemailer.Transporter | null = null;

function isMailerConfigured() {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD && env.SMTP_FROM_EMAIL);
}

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    });
  }

  return transporter;
}

export async function sendEmail(input: { to: string; subject: string; html: string }) {
  if (!isMailerConfigured()) {
    console.warn(`[mailer] SMTP is not configured; skipping email "${input.subject}" to ${input.to}.`);
    return;
  }

  await getTransporter().sendMail({
    from: `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
}
