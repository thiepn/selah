#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const outputRoot = process.env.SELAH_BSB_OUTPUT ?? join(root, '.generated/data/bsb');
const upstream = (process.env.SELAH_BSB_BASE_URL ?? 'https://raw.githubusercontent.com/BSB-publishing/bsb-data-output/main/base').replace(/\/$/, '');
const repoRoot = upstream.replace(/\/base$/, '');
const concurrency = Math.max(1, Number(process.env.SELAH_FETCH_CONCURRENCY ?? 10));

const { BOOKS } = await import('../../dist/src/domain/references/books.js');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchText(url, attempts = 4) {
  let last;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'user-agent': 'Selah-data-vendor/1.0' } });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      last = error;
      if (attempt < attempts) await sleep(250 * 2 ** (attempt - 1));
    }
  }
  throw new Error(`Failed to fetch ${url}: ${last instanceof Error ? last.message : String(last)}`);
}

async function writeAsset(relative, sourceUrl) {
  const target = join(outputRoot, relative);
  await mkdir(dirname(target), { recursive: true });
  const text = await fetchText(sourceUrl);
  await writeFile(target, text);
  return { relative, bytes: Buffer.byteLength(text) };
}

const jobs = [];
for (const book of BOOKS) {
  for (let chapter = 1; chapter <= book.chapters; chapter += 1) {
    const file = `${book.id}${chapter}.jsonl`;
    jobs.push({ relative:`display/${book.id}/${file}`, url:`${upstream}/display/${book.id}/${file}` });
    jobs.push({ relative:`index-cc-by/${book.id}/${file}`, url:`${upstream}/index-cc-by/${book.id}/${file}` });
  }
}
jobs.push({ relative:'concordance/strongs-to-verses.json', url:`${upstream}/concordance/strongs-to-verses.json` });
jobs.push({ relative:'lexicon/combined_compat.json', url:`${upstream}/lexicon/combined_compat.json` });
jobs.push({ relative:'VERSION.json', url:`${repoRoot}/VERSION.json` });
jobs.push({ relative:'ATTRIBUTION.md', url:`${repoRoot}/ATTRIBUTION.md` });
jobs.push({ relative:'LICENSE-CC0.md', url:`${repoRoot}/LICENSE-CC0.md` });
jobs.push({ relative:'LICENSE-CC-BY.md', url:`${repoRoot}/LICENSE-CC-BY.md` });

let cursor = 0;
let completed = 0;
let totalBytes = 0;
const failures = [];

async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= jobs.length) return;
    const job = jobs[index];
    try {
      const result = await writeAsset(job.relative, job.url);
      totalBytes += result.bytes;
      completed += 1;
      if (completed % 100 === 0 || completed === jobs.length) process.stdout.write(`Fetched ${completed}/${jobs.length}\n`);
    } catch (error) {
      failures.push({ ...job, error: error instanceof Error ? error.message : String(error) });
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
if (failures.length) {
  await writeFile(join(outputRoot, 'fetch-failures.json'), JSON.stringify(failures, null, 2));
  throw new Error(`${failures.length} BSB assets failed to download; see fetch-failures.json`);
}

const maxVerses = {};
for (const book of BOOKS) {
  maxVerses[book.id] = {};
  for (let chapter = 1; chapter <= book.chapters; chapter += 1) {
    const text = await readFile(join(outputRoot, `display/${book.id}/${book.id}${chapter}.jsonl`), 'utf8');
    let max = 0;
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const parsed = JSON.parse(line);
      for (const key of Object.keys(parsed.eng ?? {})) max = Math.max(max, Number(key));
    }
    maxVerses[book.id][chapter] = max;
  }
}
await writeFile(join(outputRoot, 'max-verses.json'), JSON.stringify(maxVerses));
await writeFile(join(outputRoot, 'selah-data-manifest.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  upstream,
  assets: jobs.length,
  totalBytes,
  licenses: {
    display: 'CC0',
    concordance: 'CC0',
    indexCcBy: 'CC-BY-4.0',
    lexicon: 'CC-BY-4.0'
  }
}, null, 2));
process.stdout.write(`BSB vendoring complete: ${jobs.length} assets, ${totalBytes} bytes\n`);
