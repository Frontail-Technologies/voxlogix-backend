export function passwordResetOtpEmail(input: { fullName: string; otp: string; expiresInMinutes: number }) {
  const { fullName, otp, expiresInMinutes } = input;

  return `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f4f1ea;font-family:'Segoe UI',Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f1ea;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.08);">
            <tr>
              <td style="background-color:#e0b34d;padding:28px 32px;text-align:center;">
                <span style="font-size:20px;font-weight:700;color:#1c2331;letter-spacing:0.02em;">VoxLogiX</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 12px;font-size:18px;color:#1c2331;">Reset your password</h1>
                <p style="margin:0 0 20px;font-size:14px;line-height:22px;color:#4b5563;">
                  Hi ${fullName || "there"}, use the verification code below to reset your VoxLogiX account password. This code expires in ${expiresInMinutes} minutes.
                </p>
                <div style="margin:0 0 24px;text-align:center;">
                  <span style="display:inline-block;padding:14px 28px;font-size:28px;font-weight:700;letter-spacing:8px;color:#1c2331;background-color:#f4f1ea;border-radius:12px;">
                    ${otp}
                  </span>
                </div>
                <p style="margin:0;font-size:13px;line-height:20px;color:#9ca3af;">
                  If you did not request a password reset, you can safely ignore this email — your password will remain unchanged.
                </p>
              </td>
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
