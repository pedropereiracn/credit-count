#!/usr/bin/env node
/**
 * verify-ui.mjs
 *
 * The app has 37+ checks of behaviour (scripts/verify-security.mjs) and, before this
 * file, zero of presentation. A real bug lived for days despite that: the font
 * variables were set on <body>, `--font-sans` was declared on :root (which is <html>,
 * not <body>), a CSS custom property never inherits upward, the whole declaration
 * went invalid, and every page fell back to the browser's default serif. The build
 * passed, `tsc` passed, the security gate passed, two adversarial reviews passed.
 * A person looking at the screen is what caught it.
 *
 * This gate is the thing that should have caught it, so a fix like that one never
 * needs a person again. It renders every route in a real headless browser, at the
 * width the SOW actually cares about (390px, a phone), and asserts what a person
 * would have noticed: the right typeface, nothing scrolling sideways, no broken
 * route, the security headers, and that the ranking page cannot be served stale.
 *
 * It exits non-zero on any failure and prints the same "pass" / "FAIL" shape as
 * verify-security.mjs, on purpose: the two are meant to read as siblings, and CI
 * treats them the same way.
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const need = (k) => {
  const v = process.env[k];
  if (!v) { console.error(`missing environment variable: ${k}`); process.exit(2); }
  return v;
};

const APP_URL       = need('APP_URL').replace(/\/$/, '');
const SUPABASE_URL  = need('NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/, '');
const PUBKEY        = need('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
const A_EMAIL       = need('TEST_ENTHUSIAST_EMAIL');
const A_PASSWORD    = need('TEST_ENTHUSIAST_PASSWORD');
const ADMIN_EMAIL   = need('TEST_ADMIN_EMAIL');
const ADMIN_PASSWORD = need('TEST_ADMIN_PASSWORD');

// ---------------------------------------------------------------- reporting
// Same shape as scripts/verify-security.mjs: "  pass  " / "  FAIL  ", a step banner,
// and a final tally that exits non-zero on any failure.

let failures = 0, checks = 0;

const ok   = (m) => { checks++; console.log(`  pass  ${m}`); };
const fail = (m, detail) => {
  checks++; failures++;
  console.error(`  FAIL  ${m}`);
  if (detail !== undefined) console.error(`        ${JSON.stringify(detail).slice(0, 400)}`);
};
const step = (n, title) => console.log(`\n${n}. ${title}`);

console.log(`Credit Count UI gate\n${APP_URL}`);

// ------------------------------------------------------- resolving Playwright
// This project's package.json is not this file's to touch beyond two script
// entries (CLAUDE.md): no new dependency, so `playwright` is never in
// node_modules here. `npx playwright install chromium` (sanctioned by the task
// that asked for this file) fetches the package the same way `npx -p playwright`
// does below, and caches it under npm's own npx cache.
//
// The catch: a bare `import('playwright')` resolves from *this file's own path*,
// never from $PATH, so it cannot see that cache. `npx -p playwright` can, because
// it puts the fetched package's node_modules/.bin at the front of the child
// process's PATH. So a one-line subprocess reports that PATH back, and this
// process imports the real package straight off the disk location it points at.
async function resolvePlaywright() {
  try {
    const pw = await import('playwright');
    return { pw, installCli: ['npx', ['playwright']] };
  } catch {
    // not a local dependency here, which is expected: fall through to npx.
  }

  const binDir = execFileSync(
    'npx',
    ['--yes', '-p', 'playwright', 'node', '-e',
      'process.stdout.write(process.env.PATH.split(require("path").delimiter)[0])'],
    { encoding: 'utf8' },
  ).trim();
  const pkgRoot = path.resolve(binDir, '..', '..');
  const entry = pathToFileURL(path.join(pkgRoot, 'node_modules', 'playwright', 'index.mjs')).href;
  const pw = await import(entry);
  return { pw, installCli: [path.join(binDir, 'playwright'), []] };
}

const { pw, installCli } = await resolvePlaywright();

async function launchChromium() {
  try {
    return await pw.chromium.launch();
  } catch (e) {
    if (!/Executable doesn't exist/.test(String(e?.message))) throw e;
    console.log('  ...  chromium is missing for this Playwright build, running "playwright install chromium"');
    execFileSync(installCli[0], [...installCli[1], 'install', 'chromium'], { stdio: 'inherit' });
    return await pw.chromium.launch();
  }
}

// --------------------------------------------------------------- auth setup
// A real coaster id for /admin/coasters/[id], and the two logged-in browser
// sessions the checks below run against. This talks to GoTrue and PostgREST the
// same way scripts/verify-security.mjs does, but only ever reads.

async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: PUBKEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => null);
  if (res.status !== 200 || !data?.access_token) {
    console.error(`cannot sign in as ${email}: ${res.status} ${JSON.stringify(data).slice(0, 200)}`);
    process.exit(2);
  }
  return data.access_token;
}

const adminToken = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);

const coasterRes = await fetch(`${SUPABASE_URL}/rest/v1/coasters?select=id&limit=1`, {
  headers: { apikey: PUBKEY, Authorization: `Bearer ${adminToken}` },
});
const coasterId = (await coasterRes.json().catch(() => []))?.[0]?.id;
if (!coasterId) { console.error('catalogue is empty, cannot probe /admin/coasters/[id]'); process.exit(2); }

const browser = await launchChromium();

async function loginThroughTheForm(context, email, password) {
  const page = await context.newPage();
  await page.goto(`${APP_URL}/login`, { waitUntil: 'load' });
  // exact: true, since the password field's "show password" toggle button carries
  // an aria-label ("Show password") that a substring match on "Password" would
  // also catch, and getByLabel would then refuse to fill either.
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL((u) => u.pathname === '/dashboard', { timeout: 20000 }).catch(() => {});
  const landed = new URL(page.url()).pathname === '/dashboard';
  await page.close();
  return landed;
}

step(1, 'Two real sessions, through the login form itself, not an injected cookie');

const anonContext       = await browser.newContext();
const enthusiastContext = await browser.newContext();
const adminContext      = await browser.newContext();

const enthusiastIn = await loginThroughTheForm(enthusiastContext, A_EMAIL, A_PASSWORD);
enthusiastIn
  ? ok('the enthusiast account signs in and lands on /dashboard')
  : fail('the enthusiast account did not reach /dashboard through the login form');

const adminIn = await loginThroughTheForm(adminContext, ADMIN_EMAIL, ADMIN_PASSWORD);
adminIn
  ? ok('the admin account signs in and lands on /dashboard')
  : fail('the admin account did not reach /dashboard through the login form');

if (!enthusiastIn || !adminIn) {
  console.error('cannot verify authenticated routes without a working session, stopping here');
  await browser.close();
  process.exit(failures ? 1 : 2);
}

// -------------------------------------------------------------------- routes
// Every page.tsx and route.ts under src/app today: 13. The task brief says 14;
// the project's own architecture review (docs/reviews/ARQUITETURA-GOVERNANCA.md
// 3.4) found three other documents disagreeing on the route count too, and none
// of them matching the disk. This list is the disk, read directly, so it is the
// one that will not drift: add a route under src/app, add one line here.
const ROUTES = [
  { path: '/',                                   auth: 'anon' },
  { path: '/login',                              auth: 'anon' },
  { path: '/signup',                             auth: 'anon' },
  { path: '/forgot-password',                    auth: 'anon' },
  { path: '/auth/callback',                      auth: 'anon' },
  { path: '/auth/confirm',                       auth: 'anon' },
  { path: '/reset-password',                     auth: 'enthusiast' },
  { path: '/dashboard',                          auth: 'enthusiast', creditNumber: true },
  { path: '/rides',                              auth: 'enthusiast' },
  { path: '/settings',                           auth: 'enthusiast' },
  { path: '/admin',                              auth: 'admin' },
  { path: '/admin/coasters/new',                 auth: 'admin' },
  { path: `/admin/coasters/${coasterId}`,        auth: 'admin' },
];

const contextFor = { anon: anonContext, enthusiast: enthusiastContext, admin: adminContext };

step(2, 'Every route, one real page load each: status, headers, fonts, cache, layout width at 390px');

let fontCheckedRoutes = 0;

for (const route of ROUTES) {
  const context = contextFor[route.auth];
  const page = await context.newPage();
  await page.setViewportSize({ width: 390, height: 844 });

  let response;
  try {
    response = await page.goto(`${APP_URL}${route.path}`, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(150); // let client components finish mounting before measuring layout
  } catch (e) {
    fail(`${route.path} did not load at all`, e?.message);
    await page.close();
    continue;
  }

  // --- 3. no 404, no 500 -----------------------------------------------
  const status = response?.status() ?? 0;
  (status >= 200 && status < 400)
    ? ok(`${route.path} responds ${status}`)
    : fail(`${route.path} responded ${status}`, { status });

  // --- 4. security headers ----------------------------------------------
  const headers = response?.headers() ?? {};
  const csp = headers['content-security-policy'] ?? '';
  const headersPresent = Boolean(headers['x-content-type-options']) &&
                          Boolean(headers['referrer-policy']) &&
                          csp.includes('frame-ancestors');
  headersPresent
    ? ok(`${route.path} carries x-content-type-options, referrer-policy, and a frame-ancestors CSP`)
    : fail(`${route.path} is missing a security header`, {
        'x-content-type-options': headers['x-content-type-options'] ?? null,
        'referrer-policy': headers['referrer-policy'] ?? null,
        'content-security-policy': csp || null,
      });

  // --- 5. the ranking page must never be servable stale (FR7) -----------
  if (route.path === '/') {
    const cacheControl = headers['cache-control'] ?? '';
    (cacheControl.includes('no-store') || cacheControl.includes('no-cache'))
      ? ok(`/ is not cached (cache-control: ${cacheControl})`)
      : fail('/ can be cached: an opt-out would not take effect on the next request', cacheControl || null);
  }

  // --- 1. computed fonts --------------------------------------------------
  const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily).catch(() => '');
  bodyFont.includes('Nunito')
    ? ok(`${route.path} body resolves to Nunito (got "${bodyFont.split(',')[0]}")`)
    : fail(`${route.path} body did not resolve to Nunito: fell back to "${bodyFont || '(nothing)'}"`, bodyFont);
  fontCheckedRoutes++;

  const headingFont = await page.evaluate(() => {
    const el = document.querySelector('h1, h2, h3, .font-heading, .credit-number');
    return el ? getComputedStyle(el).fontFamily : null;
  }).catch(() => null);
  if (headingFont) {
    headingFont.includes('Fredoka')
      ? ok(`${route.path} heading resolves to Fredoka (got "${headingFont.split(',')[0]}")`)
      : fail(`${route.path} heading did not resolve to Fredoka: fell back to "${headingFont}"`, headingFont);
  }

  if (route.creditNumber) {
    const creditFont = await page.evaluate(() => {
      const el = document.querySelector('.credit-number');
      return el ? getComputedStyle(el).fontFamily : null;
    }).catch(() => null);
    creditFont && creditFont.includes('Fredoka')
      ? ok(`${route.path} credit number resolves to Fredoka (got "${creditFont.split(',')[0]}")`)
      : fail(`${route.path} credit number did not resolve to Fredoka`, creditFont);
  }

  // --- 2. no horizontal scroll at 390px -----------------------------------
  const layout = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  (layout.scrollWidth <= layout.clientWidth + 1) // +1: sub-pixel rounding, not a real overflow
    ? ok(`${route.path} has no horizontal scroll at 390px (scrollWidth ${layout.scrollWidth})`)
    : fail(`${route.path} scrolls sideways at 390px`, layout);

  await page.close();
}

fontCheckedRoutes >= 4
  ? ok(`computed fonts were checked on ${fontCheckedRoutes} routes (at least 4 required)`)
  : fail(`computed fonts were only checked on ${fontCheckedRoutes} routes, need at least 4`);

// ---------------------------------------------------------------------------
await anonContext.close();
await enthusiastContext.close();
await adminContext.close();
await browser.close();

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) { console.error(`${failures} FAILED`); process.exit(1); }
console.log('every route renders, in the right typeface, at 390px, with the headers on');
