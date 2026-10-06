import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main className="page">
      <h1>Not found</h1>
      <p>
        <Link to="/">Home</Link>
      </p>
    </main>
  );
}
