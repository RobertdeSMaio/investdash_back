import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const APP_URL = process.env.APP_URL || "https://investdash.vercel.app";
const FROM = process.env.SMTP_FROM || '"InvestDash" <no-reply@investdash.app>';

export async function sendConfirmationEmail(email: string, token: string) {
  const url = `${APP_URL}/confirm-email?token=${token}&email=${encodeURIComponent(email)}`;
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Confirme seu e-mail – InvestDash",
    html: `
      <h2>Bem-vindo ao InvestDash!</h2>
      <p>Clique no link abaixo para confirmar seu endereço de e-mail:</p>
      <a href="${url}" style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">Confirmar e-mail</a>
      <p style="margin-top:16px;font-size:12px;color:#666">O link expira em 24 horas. Se não criou uma conta, ignore este e-mail.</p>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const url = `${APP_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;
  await transporter.sendMail({
    from: FROM,
    to: email,
    subject: "Redefinir senha – InvestDash",
    html: `
      <h2>Redefinição de senha</h2>
      <p>Clique no link abaixo para definir uma nova senha:</p>
      <a href="${url}" style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;">Redefinir senha</a>
      <p style="margin-top:16px;font-size:12px;color:#666">O link expira em 1 hora. Se não solicitou, ignore este e-mail.</p>
    `,
  });
}
