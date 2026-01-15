enrich_websites.py — Artist/Studio Website Enrichment

Overview
- Reads `input.csv` with columns: `name`, `url`, `notes` (optional).
- Crawls each homepage and up to 3 About/Info/Bio/Statement pages (same domain).
- Extracts only visible text, then outputs:
  - `artists_studios_enrichment.xlsx` (3 sheets: Interdisciplinary, Graphic-only, Unclear_missing)
  - `run_log.csv` (detailed crawl log)

Install
- Python 3.9+
- pip install: `pandas requests beautifulsoup4 openpyxl`

Usage
- Prepare `input.csv` with headers: `name,url,notes`.
- Run: `python3 enrich_websites.py --input input.csv --output artists_studios_enrichment.xlsx --log run_log.csv`
- Results:
  - Excel with frozen headers and filters enabled per sheet.
  - Log CSV with per-action entries (fetches, errors, classifications).

What the script extracts
- Identity: `name`, `url`, `resolved_url`, `source_pages`, `status`.
- Text: `about_text_excerpt` (up to 1500 chars), `text_length` (all combined text used).
- Education: `education_excerpt` only if explicit terms appear: studied, graduated, BA, MA, MFA, PhD, academy, university.
- Explicit term presence (boolean):
  - `mentions_design` is TRUE only if text contains (case-insensitive): `design`, `designer`, `graphic design`, `communication design`, `visual design`, `design studio` (word boundaries for single words).
  - `mentions_art` is TRUE only if text contains: `art`, `artist`, `artistic`, `contemporary art`, `visual art`, `media art` (word boundaries for single words).
- Keywords: `self_keywords` — up to 10 descriptive keywords via simple whitelist + frequency logic (e.g., installation, performance, typography, sound, research, exhibition, mapping, data).
- Classification:
  - `Interdisciplinary`: `mentions_art` TRUE and keywords include installation/performance/media/research/etc.
  - `Graphic-only`: `mentions_design` TRUE, `mentions_art` FALSE, and keywords mostly graphic (e.g., typography, identity, branding).
  - `Unclear_missing`: insufficient text or no about page or ambiguous signals.
- Quality: `confidence_score` (0–100) based on text amount, pages fetched, education presence.

Polite crawling
- 1–2 second delay per domain (enforced between requests).
- Up to 1 homepage + 3 about-like pages.
- Same-domain filtering for discovered pages.

Logging
- `run_log.csv` fields: timestamp, name, input_url, action, status, page_url, http_status, bytes, detail.
- Logs every attempt; errors never stop processing subsequent rows.

Assumptions & limitations
- Only explicit terms count for booleans; no inference or semantic guessing.
- Text extraction removes scripts/styles/headers/nav/footers/forms but may still include some boilerplate (e.g., cookie notices) depending on site markup.
- JavaScript-rendered sites are fetched as-is (no headless browser). If critical content is client-rendered, it may not be captured.
- About pages are discovered via link text or URL containing: about, info, bio, statement, profile, cv. Non-English equivalents are not included.
- Education excerpt is extracted naïvely from sentences containing the listed terms and truncated at ~500 chars.
- Classification is heuristic and conservative; ambiguous cases default to `Unclear_missing`.

Troubleshooting
- If Excel doesn’t open: ensure `openpyxl` is installed and the file isn’t open in another app.
- If some sites fail: check `run_log.csv` for HTTP status or network errors.
- If URLs lack scheme (e.g., `example.com`), the script prepends `http://` and follows redirects.

