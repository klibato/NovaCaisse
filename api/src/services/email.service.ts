import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'ssl0.ovh.net',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

const FROM = process.env.SMTP_FROM || 'NovaCaisse <noreply@novacaisse.fr>';

function baseHtml(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NovaCaisse</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f5f7;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;text-align:center;border-bottom:1px solid #e5e7eb;">
              <div style="display:inline-block;background-color:#16a34a;color:#ffffff;font-weight:bold;font-size:18px;width:40px;height:40px;line-height:40px;border-radius:10px;text-align:center;">N</div>
              <span style="font-size:22px;font-weight:bold;color:#111827;margin-left:10px;vertical-align:middle;">NovaCaisse</span>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px 40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;text-align:center;border-top:1px solid #e5e7eb;background-color:#f9fafb;">
              <p style="margin:0;font-size:13px;color:#9ca3af;">NovaCaisse — La caisse enregistreuse pour les fast-foods fran\u00e7ais</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendVerificationEmail(
  to: string,
  tenantName: string,
  token: string,
): Promise<void> {
  const verifyUrl = `https://novacaisse.fr/verify-email?token=${encodeURIComponent(token)}`;

  const html = baseHtml(`
    <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Bonjour ${tenantName},</h2>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
      Merci de votre inscription sur NovaCaisse.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.6;">
      Pour activer votre compte, cliquez sur le bouton ci-dessous :
    </p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 24px;">
      <tr>
        <td style="border-radius:8px;background-color:#16a34a;">
          <a href="${verifyUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Activer mon compte</a>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 8px;font-size:14px;color:#6b7280;line-height:1.5;">
      Ce lien expire dans 24 heures.
    </p>
    <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.5;">
      Si vous n'avez pas cr\u00e9\u00e9 de compte, ignorez cet email.
    </p>
  `);

  const text = `Bonjour ${tenantName},

Merci de votre inscription sur NovaCaisse.

Pour activer votre compte, cliquez sur le lien ci-dessous :
${verifyUrl}

Ce lien expire dans 24 heures.

Si vous n'avez pas cree de compte, ignorez cet email.

--
NovaCaisse — La caisse enregistreuse pour les fast-foods francais`;

  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'NovaCaisse — Vérifiez votre adresse email',
    html,
    text,
  });
}

export async function sendWelcomeEmail(
  to: string,
  tenantName: string,
  slug: string,
  ownerName: string,
): Promise<void> {
  const loginUrl = `https://${slug}.novacaisse.fr`;

  const html = baseHtml(`
    <h2 style="margin:0 0 16px;font-size:20px;color:#111827;">Bonjour ${ownerName},</h2>
    <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.6;">
      Votre restaurant <strong>${tenantName}</strong> est maintenant actif !
    </p>
    <p style="margin:0 0 8px;font-size:15px;color:#374151;line-height:1.6;">
      Connectez-vous sur :
    </p>
    <p style="margin:0 0 24px;">
      <a href="${loginUrl}" style="font-size:15px;color:#16a34a;font-weight:600;text-decoration:none;">${loginUrl}</a>
    </p>
    <div style="background-color:#f0fdf4;border-radius:8px;padding:20px;margin-bottom:24px;">
      <h3 style="margin:0 0 12px;font-size:16px;color:#166534;">Premiers pas</h3>
      <ol style="margin:0;padding-left:20px;font-size:14px;color:#374151;line-height:1.8;">
        <li>Connectez-vous avec votre PIN</li>
        <li>Allez dans le Back-office pour ajouter vos produits</li>
        <li>Configurez vos cat\u00e9gories et menus</li>
        <li>Commencez \u00e0 encaisser !</li>
      </ol>
    </div>
    <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.5;">
      Besoin d'aide ? Contactez-nous \u00e0 <a href="mailto:contact@novacaisse.fr" style="color:#16a34a;text-decoration:none;">contact@novacaisse.fr</a>
    </p>
  `);

  const text = `Bonjour ${ownerName},

Votre restaurant ${tenantName} est maintenant actif !

Connectez-vous sur : ${loginUrl}

Premiers pas :
1. Connectez-vous avec votre PIN
2. Allez dans le Back-office pour ajouter vos produits
3. Configurez vos categories et menus
4. Commencez a encaisser !

Besoin d'aide ? Contactez-nous a contact@novacaisse.fr

--
NovaCaisse — La caisse enregistreuse pour les fast-foods francais`;

  await transporter.sendMail({
    from: FROM,
    to,
    subject: 'Bienvenue sur NovaCaisse ! 🎉',
    html,
    text,
  });
}
