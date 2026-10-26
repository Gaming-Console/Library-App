import { lazy, Suspense, useEffect, useState } from 'react';
import type { ComponentType } from 'react';
import NotBuilt from './shell/NotBuilt';
import Shell from './shell/Shell';
import { defaultRoute, parseRoute } from './shell/routes';

const modules = import.meta.glob<{ default: ComponentType }>('./features/*/Page.tsx');
const pages = Object.fromEntries(Object.entries(modules).map(([path, load]) => [
  path.split('/')[2], lazy(load),
]));

export default function App() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const change = () => setHash(location.hash);
    addEventListener('hashchange', change);
    return () => removeEventListener('hashchange', change);
  }, []);
  const route = parseRoute(hash);
  useEffect(() => {
    if (!route) location.replace(`#/${defaultRoute}`);
  }, [route]);
  if (!route) return null;
  const Page = pages[route];
  return (
    <Shell route={route}>
      {Page
        ? <Suspense fallback={<p role="status">טוענת מסך…</p>}><Page key={hash} /></Suspense>
        : <NotBuilt route={route} />}
    </Shell>
  );
}
