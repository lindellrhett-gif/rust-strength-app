/**
 * Publishes the legal documents from their single source of truth.
 *
 * `src/legal/{privacy,terms}.ts` is what the app renders. This script compiles
 * those, then writes:
 *   legal/PRIVACY.md, legal/TERMS.md   — reviewable snapshots
 *   docs/*.html                        — the public site (GitHub Pages)
 *
 * Both stores require a publicly reachable Privacy Policy URL, and Google
 * additionally requires a web page where a user can request account deletion
 * WITHOUT installing the app. That is what docs/delete-account.html is for.
 *
 * Run: npm run legal
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '.legal-build');

// --- compile the TS sources so we can read the rendered strings -------------
fs.rmSync(OUT, { recursive: true, force: true });
// Invoke the local compiler through Node rather than `npx`, which is a .cmd
// shim on Windows and cannot be exec'd directly.
const TSC = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
execFileSync(
  process.execPath,
  [
    TSC,
    'src/legal/config.ts',
    'src/legal/privacy.ts',
    'src/legal/terms.ts',
    '--outDir',
    '.legal-build',
    '--module',
    'commonjs',
    '--target',
    'es2019',
    '--skipLibCheck',
    // TS6 refuses to mix an explicit file list with a tsconfig without this.
    '--ignoreConfig',
  ],
  { cwd: ROOT, stdio: 'inherit' },
);

const { LEGAL } = require(path.join(OUT, 'config.js'));
const { PRIVACY_POLICY } = require(path.join(OUT, 'privacy.js'));
const { TERMS_OF_SERVICE } = require(path.join(OUT, 'terms.js'));

// --- minimal markdown renderer ---------------------------------------------
// The input is ours and uses a small, known subset, so a full parser would be
// more risk than it removes.
function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function inline(s) {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function markdownToHtml(md) {
  const out = [];
  let inList = false;
  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };

  for (const rawLine of md.split('\n')) {
    const line = rawLine.trimEnd();
    if (line.trim() === '') {
      closeList();
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line.trim());
    if (bullet) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }
    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return out.join('\n');
}

// --- page shell ------------------------------------------------------------
const STYLE = `
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body {
  margin: 0; padding: 2rem 1.25rem 5rem;
  background: #0B0D10; color: #F2F5F8;
  font: 16px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
main { max-width: 46rem; margin: 0 auto; }
header { max-width: 46rem; margin: 0 auto 2.5rem; }
.brand { display: flex; align-items: center; gap: .7rem; text-decoration: none; color: inherit; }
.brand img { width: 40px; height: 40px; border-radius: 9px; }
.brand span { font-weight: 800; font-size: 1.15rem; }
nav { margin-top: 1.25rem; display: flex; flex-wrap: wrap; gap: 1.25rem; }
nav a { color: #D96F32; text-decoration: none; font-weight: 600; font-size: .95rem; }
nav a:hover { text-decoration: underline; }
h1 { font-size: 1.9rem; line-height: 1.2; margin: 0 0 1rem; }
h2 { font-size: 1.25rem; margin: 2.25rem 0 .6rem; }
h3 { font-size: 1.02rem; margin: 1.5rem 0 .4rem; color: #C7D2DC; }
p, li { color: #C9D3DD; }
ul { padding-left: 1.2rem; }
li { margin: .3rem 0; }
code {
  background: #1C222A; padding: .12em .38em; border-radius: 4px;
  font-size: .9em; color: #E6ECF2;
}
a { color: #D96F32; }
strong { color: #F2F5F8; }
footer {
  max-width: 46rem; margin: 3.5rem auto 0; padding-top: 1.5rem;
  border-top: 1px solid #2A323C; color: #7E8B98; font-size: .875rem;
}
.card {
  background: #14181D; border: 1px solid #2A323C; border-radius: 14px;
  padding: 1.25rem 1.35rem; margin: 1.25rem 0;
}
.card h2 { margin-top: 0; }
.step { display: flex; gap: .85rem; margin: .9rem 0; }
.step .n {
  flex: 0 0 1.6rem; height: 1.6rem; border-radius: 50%;
  background: #B7521E; color: #fff; font-weight: 800; font-size: .85rem;
  display: flex; align-items: center; justify-content: center;
}
`;

function page(title, body, { description } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · ${escapeHtml(LEGAL.appName)}</title>
${description ? `<meta name="description" content="${escapeHtml(description)}">` : ''}
<link rel="icon" href="./icon.png">
<style>${STYLE}</style>
</head>
<body>
<header>
  <a class="brand" href="./index.html">
    <img src="./icon.png" alt="">
    <span>${escapeHtml(LEGAL.appName)}</span>
  </a>
  <nav>
    <a href="./index.html">Home</a>
    <a href="./privacy.html">Privacy Policy</a>
    <a href="./terms.html">Terms of Service</a>
    <a href="./delete-account.html">Delete your account</a>
    <a href="./support.html">Support</a>
  </nav>
</header>
<main>
${body}
</main>
<footer>
  <p>${escapeHtml(LEGAL.appName)} is operated by ${escapeHtml(LEGAL.entity)}.
  Contact: <a href="mailto:${escapeHtml(LEGAL.contactEmail)}">${escapeHtml(LEGAL.contactEmail)}</a></p>
</footer>
</body>
</html>
`;
}

// --- write everything ------------------------------------------------------
const docs = path.join(ROOT, 'docs');
const legalDir = path.join(ROOT, 'legal');
fs.mkdirSync(docs, { recursive: true });
fs.mkdirSync(legalDir, { recursive: true });

fs.writeFileSync(path.join(legalDir, 'PRIVACY.md'), PRIVACY_POLICY);
fs.writeFileSync(path.join(legalDir, 'TERMS.md'), TERMS_OF_SERVICE);

fs.writeFileSync(
  path.join(docs, 'privacy.html'),
  page('Privacy Policy', markdownToHtml(PRIVACY_POLICY), {
    description: `How ${LEGAL.appName} handles your data.`,
  }),
);
fs.writeFileSync(
  path.join(docs, 'terms.html'),
  page('Terms of Service', markdownToHtml(TERMS_OF_SERVICE)),
);

fs.writeFileSync(
  path.join(docs, 'index.html'),
  page(
    'Home',
    `<h1>${escapeHtml(LEGAL.appName)}</h1>
<p>A workout tracker that tells you what weight to lift next. Log a set with its
reps and how hard it felt, and the app estimates your one-rep max and suggests a
weight for the next set, rounded to something the machine in front of you can
actually be set to.</p>
<p><a href="https://apps.apple.com/us/app/rust-strength/id6811736131">Get ${escapeHtml(LEGAL.appName)} on the App Store</a></p>
<div class="card">
  <h2>Legal &amp; support</h2>
  <ul>
    <li><a href="./privacy.html">Privacy Policy</a></li>
    <li><a href="./terms.html">Terms of Service</a></li>
    <li><a href="./delete-account.html">Delete your account and data</a></li>
    <li><a href="./support.html">Support</a></li>
  </ul>
</div>
<p><strong>Not medical advice.</strong> ${escapeHtml(LEGAL.appName)} suggests
training weights from the numbers you enter. It does not know your health,
injuries or experience. Use your own judgement, warm up, and stop if something
hurts.</p>`,
    { description: 'Workout tracker with autoregulated weight suggestions.' },
  ),
);

fs.writeFileSync(
  path.join(docs, 'delete-account.html'),
  page(
    'Delete your account',
    `<h1>Delete your account and data</h1>
<p>You can delete your ${escapeHtml(LEGAL.appName)} account at any time. You do
not need to contact us, and you do not need to ask permission.</p>

<div class="card">
  <h2>In the app (fastest)</h2>
  <div class="step"><div class="n">1</div><div>Open ${escapeHtml(LEGAL.appName)} and go to the <strong>Profile</strong> tab.</div></div>
  <div class="step"><div class="n">2</div><div>Tap <strong>Privacy &amp; legal</strong>.</div></div>
  <div class="step"><div class="n">3</div><div>Tap <strong>Delete my account</strong> and confirm by typing <strong>DELETE</strong>.</div></div>
  <p>Deletion happens immediately and cannot be undone.</p>
</div>

<div class="card">
  <h2>By email</h2>
  <p>If you can no longer sign in, email
  <a href="mailto:${escapeHtml(LEGAL.contactEmail)}?subject=Account%20deletion%20request">${escapeHtml(LEGAL.contactEmail)}</a>
  from the address on your account with the subject
  &ldquo;Account deletion request&rdquo;. We will verify you own the address and
  delete the account within <strong>30 days</strong>.</p>
</div>

<h2>What gets deleted</h2>
<p>Everything tied to your account is removed permanently:</p>
<ul>
  <li>Your login and email address</li>
  <li>Your username, display name, bodyweight and preferences</li>
  <li>Every workout, set, exercise, preset, planned session and rest day</li>
  <li>Every activity you logged, including any distance, steps or calories</li>
  <li>Your gyms and machines</li>
  <li>Your friendships and any pending friend requests</li>
</ul>

<h2>What may be kept, and for how long</h2>
<ul>
  <li><strong>Reports you filed about other users.</strong> Kept without your
  identity attached, so that a report cannot be erased by deleting the account
  that made it. Retained up to <strong>12 months</strong>.</li>
  <li><strong>Routine server logs</strong> held by our hosting provider, which
  may contain an IP address. These expire on their own, normally within
  <strong>30 days</strong>.</li>
</ul>
<p>Backups are overwritten on a rolling cycle, so a copy of deleted data may
persist in backup storage for a short period before being cycled out.</p>

<h2>Export instead</h2>
<p>If you want a copy of your data before deleting it, use
<strong>Profile → Privacy &amp; legal → Download my data</strong> first. Deletion
is permanent and we cannot restore an account afterwards.</p>`,
    { description: `How to delete your ${LEGAL.appName} account and data.` },
  ),
);

fs.writeFileSync(
  path.join(docs, 'support.html'),
  page(
    'Support',
    `<h1>Support</h1>
<p>Email <a href="mailto:${escapeHtml(LEGAL.contactEmail)}">${escapeHtml(LEGAL.contactEmail)}</a>
and we will get back to you.</p>
<div class="card">
  <h2>Common requests</h2>
  <ul>
    <li><a href="./delete-account.html">Delete my account and data</a></li>
    <li>Download my data — <strong>Profile → Privacy &amp; legal → Download my data</strong></li>
    <li>Report a user — open their profile and tap <strong>Report</strong></li>
    <li>Privacy questions — see the <a href="./privacy.html">Privacy Policy</a></li>
  </ul>
</div>
<h2>Reporting abuse</h2>
<p>If someone is using ${escapeHtml(LEGAL.appName)} to harass you, report them
from their profile in the app, or email us. We review every report and can
remove content or terminate accounts.</p>`,
  ),
);

// Where the "confirm your email" link lands. Supabase redirects here after
// confirming the address, so this page has to reassure and point back to the
// app — before it existed the link opened a blank localhost page and people
// assumed sign-up had failed.
//
// Supabase appends session tokens (or an error) to the URL. The script reads
// only the error fields to pick a message, then strips the whole fragment and
// query from the address bar and history, so no token lingers in a URL that
// might be copied or shared. Nothing is stored or sent anywhere.
fs.writeFileSync(
  path.join(docs, 'email-confirmed.html'),
  page(
    'Email confirmed',
    `<div id="confirmed">
<h1>Your email is confirmed</h1>
<p>Your ${escapeHtml(LEGAL.appName)} account is ready.</p>
<div class="card">
  <div class="step"><div class="n">1</div><div>Go back to the <strong>${escapeHtml(LEGAL.appName)}</strong> app on your phone.</div></div>
  <div class="step"><div class="n">2</div><div>Sign in with the email and password you just signed up with.</div></div>
</div>
<p>You can close this page.</p>
</div>

<div id="failed" hidden>
<h1>This link has expired or was already used</h1>
<p>Confirmation links work once and expire after a while.</p>
<div class="card">
  <div class="step"><div class="n">1</div><div>Open the <strong>${escapeHtml(LEGAL.appName)}</strong> app and try to sign in.</div></div>
  <div class="step"><div class="n">2</div><div>If your email is already confirmed, you are in. If not, tap <strong>Resend confirmation email</strong> and use the newest email.</div></div>
</div>
<p>Still stuck? Email <a href="mailto:${escapeHtml(LEGAL.contactEmail)}">${escapeHtml(LEGAL.contactEmail)}</a>.</p>
</div>

<script>
(function () {
  var params = new URLSearchParams(
    (location.hash || '').replace(/^#/, '') + '&' + (location.search || '').replace(/^\\?/, '')
  );
  if (params.get('error') || params.get('error_code')) {
    document.getElementById('confirmed').hidden = true;
    document.getElementById('failed').hidden = false;
  }
  if (location.hash || location.search) {
    history.replaceState(null, '', location.pathname);
  }
})();
</script>`,
    { description: `Your ${LEGAL.appName} email address is confirmed.` },
  ),
);

// The published site lives in its own PUBLIC repo so this app repo can stay
// private (GitHub Pages is only free on public repos). If that folder is
// checked out next to this one, keep it in sync automatically.
const SITE_REPO = process.env.SITE_DIR || path.join(ROOT, '..', 'rust-strength-site');

// Copy the app icon so the site has a favicon and header mark.
const icon = path.join(ROOT, 'assets', 'icon.png');
if (fs.existsSync(icon)) fs.copyFileSync(icon, path.join(docs, 'icon.png'));

// GitHub Pages otherwise runs the folder through Jekyll, which drops files
// beginning with an underscore and slows publishing down for no benefit.
fs.writeFileSync(path.join(docs, '.nojekyll'), '');

if (fs.existsSync(SITE_REPO)) {
  for (const f of fs.readdirSync(docs)) {
    fs.copyFileSync(path.join(docs, f), path.join(SITE_REPO, f));
  }
  console.log('Synced the published site at', SITE_REPO);
} else {
  console.log(
    'No site repo at',
    SITE_REPO,
    '- skipping publish sync (set SITE_DIR to override).',
  );
}

fs.rmSync(OUT, { recursive: true, force: true });

console.log('\nWrote legal/PRIVACY.md, legal/TERMS.md and docs/*.html');
if (LEGAL.entity.includes('TODO') || LEGAL.contactEmail.includes('TODO')) {
  console.log(
    '\n⚠️  src/legal/config.ts still has TODO placeholders. Fill them in and\n' +
      '   re-run `npm run legal` before publishing the site or submitting.',
  );
}
