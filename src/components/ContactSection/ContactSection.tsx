import { useState, type FormEvent, type MouseEvent } from 'react';
import { createLucideIcon, Mail } from 'lucide-react';
import { useInView } from '../ExperienceDiagram/useInView.ts';
import './ContactSection.css';

// Reusable contact section — Home + the ProjectLayout end prompt share it.
// Structure first, tokens later: neutral greys, page gutters, no type styling.
//
// Addresses ported from v1 (contact.jsx). Submit path mirrors v1 too:
// POST { name, email, message } → /api/contact (Cloudflare Function +
// Resend, see functions/api/contact.js), visitor's address as reply_to.
export interface ContactDetails {
  email: string;
  linkedinUrl: string;
  instagramUrl: string;
}

export const DEFAULT_CONTACT: ContactDetails = {
  email: 'noahhett@gmail.com',
  linkedinUrl: 'https://linkedin.com/in/noahhett',
  instagramUrl: 'https://ig.me/m/nh_portfolio_',
};

// Brand glyphs in the lucide stroke style. lucide-react dropped brand
// icons, so these are recreated here from the feather originals (same
// 24×24 stroke language as Mail, accepts the same `size` prop).
const LinkedinIcon = createLucideIcon('Linkedin', [
  [
    'path',
    {
      d: 'M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z',
    },
  ],
  ['rect', { x: '2', y: '9', width: '4', height: '12' }],
  ['circle', { cx: '4', cy: '4', r: '2' }],
]);

const InstagramIcon = createLucideIcon('Instagram', [
  ['rect', { x: '2', y: '2', width: '20', height: '20', rx: '5', ry: '5' }],
  [
    'path',
    { d: 'M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z' },
  ],
  ['line', { x1: '17.5', y1: '6.5', x2: '17.51', y2: '6.5' }],
]);

// "Mobile" for the mail action = coarse pointer or narrow viewport —
// matches the 600px breakpoint the mail row CSS pivots on.
function isMobileMail(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 600;
}

export interface ContactSectionProps {
  contact?: ContactDetails;
}

type SubmitStatus = 'success' | 'error' | null;

export default function ContactSection({
  contact = DEFAULT_CONTACT,
}: ContactSectionProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>(null);
  // Entrance: the site's masked rise language (.rv/.rv-inner, 80ms
  // staggers) — fires once via useInView, end state forced under
  // reduced-motion by both the hook and the CSS below.
  // The observer sits on the heading, not the section: this block is
  // ≥60vh tall, so a threshold against the whole section fires while
  // it's still mostly below the fold and the rise finishes before
  // arrival. A small target fires as the content actually enters.
  const { ref: headingRef, inView } = useInView<HTMLHeadingElement>(0.3);

  // Mail link: tap opens the mail app on mobile, click copies on desktop
  // (v1 did exactly this: clipboard on desktop, mailto: icon on mobile).
  // Clipboard in insecure contexts throws — fall back to mailto so the
  // address is never unreachable.
  const onMailActivate = async (e: MouseEvent<HTMLAnchorElement>): Promise<void> => {
    if (isMobileMail()) return; // let the mailto: href run
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(contact.email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.location.href = `mailto:${contact.email}`;
    }
  };

  const isFormValid =
    name.trim() !== '' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    message.trim() !== '';

  const onSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!isFormValid || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitStatus(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), message: message.trim() }),
      });
      if (res.ok) {
        setSubmitStatus('success');
        setName('');
        setEmail('');
        setMessage('');
        window.setTimeout(() => setSubmitStatus(null), 5000);
      } else {
        setSubmitStatus('error');
      }
    } catch {
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contact" className={`contact${inView ? ' in' : ''}`} aria-labelledby="contact-heading">
      <h2 ref={headingRef} id="contact-heading" className="contact-heading rv">
        <span className="rv-inner">Contact</span>
      </h2>
      <div className="contact-grid">
        <ul className="contact-links contact-links--text" aria-label="Social links">
          <li className="rv rv-d1">
            <span className="rv-inner">
            <a href={contact.linkedinUrl} target="_blank" rel="noreferrer">
              <span className="contact-link-label">LinkedIn</span>
              <span className="contact-link-hint" aria-hidden="true">↗</span>
            </a>
            </span>
          </li>
          <li className="rv rv-d2">
            <span className="rv-inner">
            <a href={contact.instagramUrl} target="_blank" rel="noreferrer">
              <span className="contact-link-label">Instagram</span>
              <span className="contact-link-hint" aria-hidden="true">↗</span>
            </a>
            </span>
          </li>
          <li className="rv rv-d3">
            <span className="rv-inner">
            <a
              href={`mailto:${contact.email}`}
              onClick={(e) => void onMailActivate(e)}
              aria-live="polite"
            >
              <span className="contact-link-label">Email</span>
              <span className="contact-link-hint" aria-hidden="true">
                {copied ? 'Copied ✓' : 'Copy'}
              </span>
            </a>
            </span>
          </li>
        </ul>

        {/* Symbol row for small screens — same three links as icons (v1 did
            this too). Shown ≤600px; the text list above is desktop-only. */}
        <ul className="contact-links contact-links--icons" aria-label="Social links">
          <li>
            <a href={contact.linkedinUrl} target="_blank" rel="noreferrer" aria-label="LinkedIn">
              <LinkedinIcon size={30} aria-hidden="true" />
            </a>
          </li>
          <li>
            <a href={contact.instagramUrl} target="_blank" rel="noreferrer" aria-label="Instagram">
              <InstagramIcon size={30} aria-hidden="true" />
            </a>
          </li>
          <li>
            <a href={`mailto:${contact.email}`} onClick={(e) => void onMailActivate(e)} aria-label="Email">
              <Mail size={30} aria-hidden="true" />
            </a>
          </li>
        </ul>

        <form className="contact-form" onSubmit={(e) => void onSubmit(e)} aria-label="Send a message">
          <div className="contact-field rv rv-d1">
            <span className="rv-inner">
            <label htmlFor="contact-name">Name</label>
            <input
              id="contact-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSubmitStatus(null);
              }}
            />
            </span>
          </div>
          <div className="contact-field rv rv-d2">
            <span className="rv-inner">
            <label htmlFor="contact-email">Email</label>
            <input
              id="contact-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setSubmitStatus(null);
              }}
            />
            </span>
          </div>
          <div className="contact-field contact-field--span rv rv-d3">
            <span className="rv-inner">
            <label htmlFor="contact-message">Message</label>
            <textarea
              id="contact-message"
              name="message"
              rows={4}
              required
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setSubmitStatus(null);
              }}
            />
            </span>
          </div>
          {/* Send only exists once the form is sendable (v1 did this too) —
              no dead button eating vertical room at rest. Right-aligned,
              clear of the fields. */}
          {isFormValid && (
            <button className="contact-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sending…' : 'Send message'}
            </button>
          )}
          {submitStatus === 'success' && (
            <p className="contact-status contact-status--success" role="status">
              Message sent ✓
            </p>
          )}
          {submitStatus === 'error' && (
            <p className="contact-status contact-status--error" role="alert">
              Failed to send — please try again or email{' '}
              <a href={`mailto:${contact.email}`}>{contact.email}</a> directly.
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
