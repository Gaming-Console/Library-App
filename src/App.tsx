import { lazy, Suspense, useEffect, useState } from 'react';
import type { ComponentType } from 'react';

const modules = import.meta.glob<{ default: ComponentType }>('./features/*/Page.tsx');
const pages = Object.fromEntries(Object.entries(modules).map(([path, load]) => [
  path.split('/')[2], lazy(load),
]));

export default function App() {
  const [route, setRoute] = useState(location.hash.slice(2));
  useEffect(() => {
    const change = () => setRoute(location.hash.slice(2));
    addEventListener('hashchange', change);
    return () => removeEventListener('hashchange', change);
  }, []);
  const Page = pages[route.split('?')[0]];
  if (Page) return <Suspense fallback={<p>טוענת מסך…</p>}><Page key={route} /></Suspense>;
  return (
    <main className="blank">
      <span>סדנת הפיתוח · ספריית בית הספר</span>
      <h1>מתחילות מדף ריק.</h1>
      <p>אין כאן עדיין מערכת ספרייה. אתן תבנו אותה.</p>
      <a href="/workshop/index.html">לכרטיסי המשימה ולהדמיות ←</a>
      {Object.keys(pages).length > 0 && <nav aria-label="מסכים שנבנו">{Object.keys(pages).map((id) => <a key={id} href={`#/${id}`}>{id}</a>)}</nav>}
    </main>
  );
}
