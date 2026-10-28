import { Link } from 'react-router-dom';
import './NotFound.css';

// Branded 404: same display type as the WORK title and the outlined
// buttons used under Experience, so a dead link still lands on-brand.
export default function NotFound() {
  return (
    <main className="page page-404">
      <title>Not found</title>
      <p className="nf-code" aria-hidden="true">
        404
      </p>
      <h1 className="nf-title">This page doesn’t exist.</h1>
      <ul className="nf-links">
        <li>
          <Link to="/">Home</Link>
        </li>
        <li>
          <Link to="/projects">All work</Link>
        </li>
      </ul>
    </main>
  );
}
