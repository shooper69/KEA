import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const templatesDir = path.join(root, 'supabase', 'templates')
const LOGO = 'https://kea.chat/kea-mark.png?v=2'
const SITE = 'https://kea.chat'

function wrapEmail({ title, greeting, paragraphs, buttonLabel, buttonHref, afterButton, code }) {
  const paras = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-family:Georgia,'Iowan Old Style',Palatino,'Times New Roman',serif;font-size:17px;line-height:1.6;color:#243044;">${p}</p>`,
    )
    .join('\n')

  const button = buttonLabel
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:28px auto 8px;">
              <tr>
                <td align="center" bgcolor="#5b6cff" style="border-radius:999px;background:#5b6cff;background-image:linear-gradient(135deg,#3ec6ff,#6b7bff 52%,#c45bff);">
                  <a href="${buttonHref}" target="_blank" style="display:inline-block;padding:16px 36px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:17px;font-weight:600;line-height:1.3;color:#ffffff;text-decoration:none;border-radius:999px;min-width:180px;text-align:center;">${buttonLabel}</a>
                </td>
              </tr>
            </table>`
    : ''

  const codeBlock = code
    ? `<p style="margin:24px 0 8px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:32px;letter-spacing:0.28em;font-weight:700;color:#1a2744;text-align:center;">${code}</p>`
    : ''

  const after = afterButton
    ? `<p style="margin:20px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.55;color:#6b778c;">${afterButton}</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#0c1424;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${greeting}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0c1424;background-image:linear-gradient(165deg,#0a1224 0%,#12304a 42%,#0e3a32 100%);">
      <tr>
        <td align="center" style="padding:28px 16px 40px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
            <tr>
              <td align="center" style="padding:36px 24px 28px;">
                <img src="${LOGO}" alt="Kea" width="240" style="display:block;margin:0 auto;width:240px;max-width:78%;height:auto;border:0;outline:none;text-decoration:none;" />
              </td>
            </tr>
            <tr>
              <td bgcolor="#ffffff" style="background:#ffffff;border-radius:20px;padding:36px 28px 32px;">
                <h1 style="margin:0 0 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:26px;line-height:1.25;font-weight:650;color:#152033;text-align:center;">${title}</h1>
                ${paras}
                ${codeBlock}
                ${button}
                ${after}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:28px 12px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;line-height:1.6;color:#c5d4e8;">
                Kea is a conversational companion — we talk, and language arrives along the way.<br />
                <a href="${SITE}" style="color:#9be7ff;text-decoration:none;">kea.chat</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`
}

export const keaAuthEmails = {
  confirmation: {
    subject: 'Confirm your email — then we can talk',
    html: wrapEmail({
      title: 'Glad you are here',
      greeting: 'Confirm your email and Kea will be ready to talk.',
      paragraphs: [
        'This is Kea — a conversational companion. We sit with the language you care about and talk it into being, naturally.',
        'Tap below to confirm this email. After that, we can pick up whenever you are ready.',
      ],
      buttonLabel: 'Confirm email',
      buttonHref: '{{ .ConfirmationURL }}',
      afterButton: 'If you did not create a Kea account, you can ignore this note.',
    }),
  },
  invite: {
    subject: 'You are invited to talk with Kea',
    html: wrapEmail({
      title: 'Come talk with Kea',
      greeting: 'You have been invited to Kea.',
      paragraphs: [
        'Someone thought you would enjoy a companion who talks with you — warm, curious, and unhurried.',
        'Accept the invitation and we will meet you there.',
      ],
      buttonLabel: 'Accept invitation',
      buttonHref: '{{ .ConfirmationURL }}',
    }),
  },
  recovery: {
    subject: 'Reset your Kea password',
    html: wrapEmail({
      title: 'A fresh start',
      greeting: 'Choose a new password for Kea.',
      paragraphs: [
        'We received a request to reset the password on this account. No fuss — choose a new one below.',
      ],
      buttonLabel: 'Choose a new password',
      buttonHref: '{{ .ConfirmationURL }}',
      afterButton: 'If you did not ask for this, you can ignore this note. Your account stays as it is.',
    }),
  },
  magicLink: {
    subject: 'Your Kea sign-in link',
    html: wrapEmail({
      title: 'Your way back in',
      greeting: 'One tap to sign in to Kea.',
      paragraphs: [
        'Here is a one-time link to sign in. It does not last long, and it only works once — which is how it should be.',
      ],
      buttonLabel: 'Sign in to Kea',
      buttonHref: '{{ .ConfirmationURL }}',
      afterButton: 'If you did not ask to sign in, you can ignore this note.',
    }),
  },
  emailChange: {
    subject: 'Confirm your new Kea email',
    html: wrapEmail({
      title: 'Confirm this address',
      greeting: 'Confirm your new email for Kea.',
      paragraphs: [
        'We will use <strong>{{ .NewEmail }}</strong> from now on, once you confirm it.',
        'If this was you, tap below. If it was not, leave this note alone and nothing changes.',
      ],
      buttonLabel: 'Confirm new email',
      buttonHref: '{{ .ConfirmationURL }}',
    }),
  },
  reauthentication: {
    subject: '{{ .Token }} is your Kea code',
    html: wrapEmail({
      title: 'Your Kea code',
      greeting: 'Use this code to confirm it is you.',
      paragraphs: [
        'Use the code below to confirm it is you. It expires shortly, so there is no need to save it.',
      ],
      code: '{{ .Token }}',
    }),
  },
}

const files = {
  'confirmation.html': keaAuthEmails.confirmation,
  'invite.html': keaAuthEmails.invite,
  'recovery.html': keaAuthEmails.recovery,
  'magic-link.html': keaAuthEmails.magicLink,
  'email-change.html': keaAuthEmails.emailChange,
  'reauthentication.html': keaAuthEmails.reauthentication,
}

export function writeKeaAuthEmailFiles() {
  fs.mkdirSync(templatesDir, { recursive: true })
  for (const [name, spec] of Object.entries(files)) {
    fs.writeFileSync(path.join(templatesDir, name), `${spec.html.trim()}\n`)
  }

  const sample = (html) =>
    html
      .replaceAll('{{ .ConfirmationURL }}', 'https://kea.chat')
      .replaceAll('{{ .NewEmail }}', 'you@example.com')
      .replaceAll('{{ .Token }}', '482917')

  const sections = Object.entries(keaAuthEmails)
    .map(
      ([key, spec]) =>
        `<section style="margin:0 0 48px;"><p style="color:#9be7ff;font-family:sans-serif;text-align:center;">${key} — ${spec.subject}</p>${sample(spec.html)}</section>`,
    )
    .join('\n')

  fs.writeFileSync(
    path.join(templatesDir, 'preview.html'),
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Kea auth emails</title></head><body style="margin:0;background:#061018;">${sections}</body></html>\n`,
  )
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) writeKeaAuthEmailFiles()
