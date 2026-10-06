import { env } from "../env";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface Mailer {
  readonly name: string;
  send(msg: MailMessage): Promise<void>;
}

/** Fallback: no transport configured. Never logs the recipient address (152-FZ). */
class LogMailer implements Mailer {
  readonly name = "log";
  readonly outbox: MailMessage[] = [];
  async send(msg: MailMessage) {
    this.outbox.push(msg);
    if (env().NODE_ENV !== "test") console.info(`[mail:log] subject="${msg.subject}" (recipient hidden)`);
  }
}

class SmtpMailer implements Mailer {
  readonly name = "smtp";
  async send(msg: MailMessage) {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({ host: env().SMTP_HOST, port: env().SMTP_PORT, secure: false });
    await transport.sendMail({ from: env().MAIL_FROM, ...msg });
  }
}

class ResendMailer implements Mailer {
  readonly name = "resend";
  async send(msg: MailMessage) {
    const { Resend } = await import("resend");
    const client = new Resend(env().RESEND_API_KEY);
    const res = await client.emails.send({ from: env().MAIL_FROM, ...msg });
    if (res.error) throw new Error(`resend: ${res.error.message}`);
  }
}

let mailer: Mailer | null = null;

export function getMailer(): Mailer {
  if (mailer) return mailer;
  const e = env();
  if (e.NODE_ENV === "test") mailer = new LogMailer();
  else if (e.RESEND_API_KEY) mailer = new ResendMailer();
  else if (e.SMTP_HOST) mailer = new SmtpMailer();
  else mailer = new LogMailer();
  return mailer;
}

/** Sends mail without failing the business operation if the transport is down. */
export async function sendMailSafe(msg: MailMessage) {
  try {
    await getMailer().send(msg);
    return true;
  } catch (e) {
    console.error("[mail] send failed:", (e as Error).message);
    return false;
  }
}

export function setMailerForTests(m: Mailer | null) {
  mailer = m;
}
export { LogMailer };
