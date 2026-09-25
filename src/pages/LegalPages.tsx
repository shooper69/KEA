import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CloudAtmosphere } from '../components/companion/CloudAtmosphere'
import { SiteFooter } from '../components/companion/SiteFooter'
import {
  clearCookieConsentChoice,
  COOKIE_CONSENT_EVENT,
  getCookieConsent,
  setCookieConsent,
  type CookieConsentChoice,
} from '../architecture/keaCookieConsent'

export function LegalDocumentPage({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <main className="companion-screen legal-screen">
      <CloudAtmosphere presence="idle" />
      <div className="legal-screen__content">
        <div className="settings-title-row">
          <h1>{title}</h1>
          <Link to="/" className="settings-close" aria-label="Back to Kea">
            ×
          </Link>
        </div>
        <article className="settings-card legal-doc">{children}</article>
        <SiteFooter tone="plain" />
      </div>
    </main>
  )
}

export function PrivacyPolicyPage() {
  return (
    <LegalDocumentPage title="Privacy Policy">
      <p className="legal-doc__updated">Last updated: 25 September 2026</p>
      <p>
        Kea (“we”, “us”) provides a conversational language companion at{' '}
        <a href="https://kea.chat">kea.chat</a>. This policy explains what
        information we collect, how we use it, and your choices.
      </p>
      <h2>Who we are</h2>
      <p>
        For privacy questions, contact{' '}
        <a href="mailto:team@kea.chat">team@kea.chat</a>.
      </p>
      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>Account details</strong> — such as name, email, and sign-in
          credentials when you create an account.
        </li>
        <li>
          <strong>Conversation and learning data</strong> — messages, language
          preferences, Learn List items, and topics you choose to keep, so Kea
          can talk with you and remember what helps.
        </li>
        <li>
          <strong>Subscription and billing</strong> — plan status and payment
          references handled by our payment provider (for example Stripe). We do
          not store full card numbers on Kea servers.
        </li>
        <li>
          <strong>Device and usage</strong> — if you accept analytics cookies, we
          may collect page views and similar first-party analytics to improve the
          product. See our{' '}
          <Link to="/cookie-policy">Cookie Policy</Link>.
        </li>
      </ul>
      <h2>How we use information</h2>
      <ul>
        <li>To provide and improve Kea’s conversation and learning features.</li>
        <li>To manage your account, trial, and subscription.</li>
        <li>To respond to support requests at team@kea.chat.</li>
        <li>
          To keep the service secure and to meet legal obligations when
          required.
        </li>
      </ul>
      <h2>Sharing</h2>
      <p>
        We use trusted processors (hosting, authentication, speech, and
        payments) only as needed to run Kea. We do not sell your personal
        information.
      </p>
      <h2>Retention</h2>
      <p>
        We keep account and conversation data while your account is active, and
        for a reasonable period afterward if needed for support, billing, or
        legal reasons. You can ask us to delete your account by emailing{' '}
        <a href="mailto:team@kea.chat">team@kea.chat</a>.
      </p>
      <h2>Your rights</h2>
      <p>
        Depending on where you live, you may have rights to access, correct,
        delete, or export your data, or to object to certain processing. Contact
        us to exercise these rights.
      </p>
      <h2>Children</h2>
      <p>
        Kea is not directed at children under 13 (or the minimum age required in
        your country). If you believe a child has created an account, contact us.
      </p>
      <h2>Changes</h2>
      <p>
        We may update this policy. The “Last updated” date at the top will
        change when we do. Continued use of Kea after changes means you accept
        the updated policy.
      </p>
    </LegalDocumentPage>
  )
}

export function TermsOfServicePage() {
  return (
    <LegalDocumentPage title="Terms of Service">
      <p className="legal-doc__updated">Last updated: 25 September 2026</p>
      <p>
        These terms govern your use of Kea at{' '}
        <a href="https://kea.chat">kea.chat</a>. By using Kea you agree to them.
      </p>
      <h2>The service</h2>
      <p>
        Kea is a conversational companion that helps you practise languages.
        Features, plans, and availability may change as we improve the product.
      </p>
      <h2>Accounts</h2>
      <p>
        You are responsible for your account and for keeping your sign-in details
        safe. Provide accurate information and use Kea only for lawful purposes.
      </p>
      <h2>Subscriptions and trials</h2>
      <p>
        Free trials and paid plans are described on the Subscription page.
        Charges are handled by our payment provider. Fees are generally
        non-refundable except where required by law or stated otherwise at
        checkout.
      </p>
      <h2>Acceptable use</h2>
      <p>
        Do not misuse Kea, attempt to break security, scrape the service at
        scale, or use it to harm others. We may suspend accounts that violate
        these terms.
      </p>
      <h2>Content and AI</h2>
      <p>
        Kea’s replies are generated with AI and may be imperfect. You remain
        responsible for how you use what Kea says. Do not rely on Kea for
        medical, legal, or other professional advice.
      </p>
      <h2>Intellectual property</h2>
      <p>
        Kea’s name, branding, and software belong to us or our licensors. You
        keep rights to the content you submit; you grant us a licence to process
        it to provide the service.
      </p>
      <h2>Disclaimer</h2>
      <p>
        Kea is provided “as is”. To the fullest extent allowed by law, we
        disclaim warranties of uninterrupted or error-free service.
      </p>
      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent allowed by law, we are not liable for indirect or
        consequential losses arising from your use of Kea. Our total liability
        for a claim is limited to the amount you paid us for Kea in the three
        months before the claim.
      </p>
      <h2>Contact</h2>
      <p>
        Questions about these terms: <a href="mailto:team@kea.chat">team@kea.chat</a>.
      </p>
    </LegalDocumentPage>
  )
}

export function CookiePolicyPage() {
  const [choice, setChoice] = useState<CookieConsentChoice | null>(() =>
    getCookieConsent(),
  )

  useEffect(() => {
    function sync() {
      setChoice(getCookieConsent())
    }
    window.addEventListener(COOKIE_CONSENT_EVENT, sync)
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, sync)
  }, [])

  return (
    <LegalDocumentPage title="Cookie Policy">
      <p className="legal-doc__updated">Last updated: 25 September 2026</p>
      <p>
        This policy explains how Kea uses cookies and similar storage on{' '}
        <a href="https://kea.chat">kea.chat</a>.
      </p>
      <h2>What are cookies?</h2>
      <p>
        Cookies and local storage help the site remember choices, keep you signed
        in, and — if you allow it — understand how people use Kea.
      </p>
      <h2>Necessary cookies</h2>
      <p>
        These are needed for Kea to work: sign-in sessions, security, and basic
        preferences. They do not require consent beyond using the service.
      </p>
      <h2>Analytics cookies</h2>
      <p>
        If you Accept, we use first-party analytics (page views and similar) to
        improve Kea. If you Reject non-essential cookies, we do not run this
        analytics. Details are also in our{' '}
        <Link to="/privacy-policy">Privacy Policy</Link>.
      </p>
      <h2>Your choice</h2>
      <p>
        Current preference:{' '}
        <strong>
          {choice === 'accepted'
            ? 'Analytics accepted'
            : choice === 'rejected'
              ? 'Analytics rejected'
              : 'Not chosen yet'}
        </strong>
      </p>
      <div className="cookie-policy__actions">
        <button
          type="button"
          className="kea-button"
          onClick={() => setCookieConsent('accepted')}
        >
          Accept analytics
        </button>
        <button
          type="button"
          className="kea-button kea-button--ghost"
          onClick={() => setCookieConsent('rejected')}
        >
          Reject non-essential
        </button>
        <button
          type="button"
          className="discount-code__clear"
          onClick={() => clearCookieConsentChoice()}
        >
          Reset and show banner
        </button>
      </div>
      <h2>More information</h2>
      <p>
        Contact <a href="mailto:team@kea.chat">team@kea.chat</a> with cookie
        questions.
      </p>
    </LegalDocumentPage>
  )
}
