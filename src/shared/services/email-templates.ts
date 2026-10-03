const BRAND_COLOR = "#e0b34d";
const BRAND_TEXT = "#1c2331";

function emailShell(body: string) {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f4f1ea;font-family:'Segoe UI',Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f1ea;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.08);">
            <tr>
              <td style="background-color:${BRAND_COLOR};padding:28px 32px;text-align:center;">
                <span style="font-size:20px;font-weight:700;color:${BRAND_TEXT};letter-spacing:0.02em;">VoxLogiX</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">${body}</td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background-color:#f9fafb;text-align:center;">
                <span style="font-size:12px;color:#9ca3af;">&copy; ${new Date().getFullYear()} VoxLogiX. All rights reserved.</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function passwordResetLinkEmail(input: { fullName: string; resetUrl: string; expiresInMinutes: number }) {
  const { fullName, resetUrl, expiresInMinutes } = input;

  return emailShell(`
    <h1 style="margin:0 0 12px;font-size:18px;color:${BRAND_TEXT};">Reset your password</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:22px;color:#4b5563;">
      Hi ${fullName || "there"}, we received a request to reset your VoxLogiX password. Click the button below to choose a new password. This link expires in ${expiresInMinutes} minutes.
    </p>
    <div style="margin:0 0 24px;text-align:center;">
      <a href="${resetUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:${BRAND_TEXT};background-color:${BRAND_COLOR};border-radius:12px;text-decoration:none;">Reset Password</a>
    </div>
    <p style="margin:0;font-size:13px;line-height:20px;color:#9ca3af;">
      If you did not request a password reset, you can safely ignore this email — your password will remain unchanged. Do not share this link with anyone.
    </p>`);
}

export function welcomeNewUserEmail(input: { fullName: string; temporaryPassword: string; loginUrl: string }) {
  const { fullName, temporaryPassword, loginUrl } = input;

  return emailShell(`
    <h1 style="margin:0 0 12px;font-size:18px;color:${BRAND_TEXT};">Welcome to VoxLogiX</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:22px;color:#4b5563;">
      Hi ${fullName || "there"}, your VoxLogiX account has been created. Use the temporary password below to sign in, then you will be prompted to set a new password immediately.
    </p>
    <div style="margin:0 0 24px;background-color:#f4f1ea;border-radius:12px;padding:16px 20px;">
      <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;">Temporary Password</p>
      <p style="margin:0;font-size:18px;font-weight:700;color:${BRAND_TEXT};letter-spacing:0.04em;">${temporaryPassword}</p>
    </div>
    <div style="margin:0 0 24px;text-align:center;">
      <a href="${loginUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:${BRAND_TEXT};background-color:${BRAND_COLOR};border-radius:12px;text-decoration:none;">Sign In</a>
    </div>
    <p style="margin:0;font-size:13px;line-height:20px;color:#9ca3af;">
      For your security, please change your password immediately after signing in. Do not share this email or your temporary password with anyone.
    </p>`);
}
