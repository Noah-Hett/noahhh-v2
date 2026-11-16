import { StrictMode, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const container = document.getElementById('root')!;

// Built pages ship a hidden static snapshot for crawlers (scripts/
// prerender.mjs). createRoot replaces it on first commit; un-hide in the
// same commit, before paint, so the snapshot never flashes.
function RevealRoot() {
  useLayoutEffect(() => {
    container.removeAttribute('data-prerendered');
  }, []);
  return null;
}

createRoot(container).render(
  <StrictMode>
    <RevealRoot />
    <App />
  </StrictMode>,
);
