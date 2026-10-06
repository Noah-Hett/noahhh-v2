// About: more-about-me page (header nav). Placeholder shell until spec
// lands — title + intro, closed by the shared ContactSection so the
// header Contact link scrolls in place here.
import ContactSection from '../components/ContactSection/ContactSection.tsx';

export default function About() {
  return (
    <main className="page">
      <h1>About</h1>
      <p>More about me — full page spec open.</p>
      <ContactSection />
    </main>
  );
}
