/**
 * Standalone SEO checker — same contract as tests/seo.test.ts, no test runner.
 *
 *   bun run seo:check                 # checks production (jftstores.lovable.app)
 *   SEO_ORIGIN=http://localhost:8080 bun run seo:check
 *
 * Exits non-zero on any violation, so it can gate a deploy.
 */
import {
  CORE_ROUTES,
  DISALLOWED_PATHS,
  PRODUCTION_ORIGIN,
  checkPage,
  fetchHtml,
  parseHead,
  type Failure,
} from "../tests/seo-contract";

const ORIGIN = process.env["SEO_ORIGIN"] ?? PRODUCTION_ORIGIN;

async function main() {
  const failures: Failure[] = [];

  for (const route of CORE_ROUTES) {
    try {
      const meta = parseHead(await fetchHtml(ORIGIN, route.path));
      failures.push(...checkPage(route, meta, ORIGIN));
    } catch (err) {
      failures.push({ path: route.path, problem: (err as Error).message });
    }
  }

  const robots = await fetch(`${ORIGIN}/robots.txt`);
  if (!robots.ok) failures.push({ path: "/robots.txt", problem: `responded ${robots.status}` });
  else {
    const txt = await robots.text();
    if (/^\s*Disallow:\s*\/\s*$/im.test(txt))
      failures.push({ path: "/robots.txt", problem: "blocks the whole site" });
    for (const p of DISALLOWED_PATHS)
      if (!new RegExp(`^\\s*Disallow:\\s*${p}\\s*$`, "im").test(txt))
        failures.push({ path: "/robots.txt", problem: `missing Disallow: ${p}` });
  }

  const sitemap = await fetch(`${ORIGIN}/sitemap.xml`);
  if (!sitemap.ok) failures.push({ path: "/sitemap.xml", problem: `responded ${sitemap.status}` });
  else {
    const xml = await sitemap.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    for (const route of CORE_ROUTES) {
      const url = `${PRODUCTION_ORIGIN}${route.path}`;
      const listed = locs.includes(url);
      if (route.noindex && listed)
        failures.push({ path: "/sitemap.xml", problem: `${route.path} must not be listed` });
      if (!route.noindex && !listed)
        failures.push({ path: "/sitemap.xml", problem: `${route.path} is missing` });
    }
  }

  if (failures.length === 0) {
    console.log(`SEO check passed for ${ORIGIN} (${CORE_ROUTES.length} routes).`);
    return;
  }
  console.error(`SEO check FAILED for ${ORIGIN}:`);
  for (const f of failures) console.error(`  ${f.path}: ${f.problem}`);
  process.exitCode = 1;
}

void main();
