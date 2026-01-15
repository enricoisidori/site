"""Simple OpenAlex network builder.
Fetches seed works for a keyword and stores nodes/edges CSV files.
"""

import csv
from typing import Dict, List, Optional

import requests

# Parameters that can be adjusted if needed.
# Ricerca mirata: parola/frase chiave da cercare nel titolo
KEYWORD = "communication design"
MAX_PAPERS = 100
MAX_REFERENCES_PER_PAPER = 20
BASE_URL = "https://api.openalex.org/works"
PER_PAGE = 50

# Header consigliato da OpenAlex per contatto/debug
USER_AGENT = "OpenAlex network builder (mailto:you@example.com)"

# Opzione: arricchire i riferimenti con disciplina e conteggi per disciplina
COMPUTE_DISCIPLINES = True


def fetch_json(url: str, params: Optional[Dict[str, str]] = None) -> Optional[Dict]:
    """Perform a GET request and return parsed JSON, printing simple errors."""
    try:
        response = requests.get(url, params=params, timeout=30, headers={"User-Agent": USER_AGENT})
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        print(f"Request failed: {exc}")
        return None


def fetch_seed_works(keyword: str, max_papers: int) -> List[Dict]:
    """Fetch seed works sorted by citation count, handling pagination."""
    collected: List[Dict] = []
    page = 1

    while len(collected) < max_papers:
        # Filtra per titolo contenente esattamente la frase (title.search)
        # e ordina per citazioni decrescenti. Limita i campi per risposta più leggera.
        params = {
            "filter": f"title.search:\"{keyword}\"",
            "sort": "cited_by_count:desc",
            "per-page": str(PER_PAGE),
            "page": str(page),
            "select": (
                "id,doi,display_name,publication_year,type,primary_location,authorships,language,"
                "cited_by_count,referenced_works_count,referenced_works,related_works,open_access,"
                "primary_topic,fwci,citation_normalized_percentile"
            ),
        }
        data = fetch_json(BASE_URL, params=params)
        if not data:
            break

        results = data.get("results", [])
        if not results:
            print("No more works available from the API.")
            break

        collected.extend(results)
        print(f"Fetched {len(collected)} works so far...")

        if len(results) < PER_PAGE:
            # API returned fewer results than requested, so no more pages to fetch.
            break
        page += 1

    return collected[:max_papers]


def _uniq_preserve(seq: List[str]) -> List[str]:
    seen = set()
    out: List[str] = []
    for s in seq:
        if s and s not in seen:
            seen.add(s)
            out.append(s)
    return out


def prepare_node_rows(works: List[Dict]) -> List[Dict[str, str]]:
    """Convert raw work JSON into rows for the nodes CSV with rich metadata."""
    rows: List[Dict[str, str]] = []
    for work in works:
        work_id = work.get("id") or ""
        title = work.get("display_name") or ""
        year = work.get("publication_year") or ""
        doi = work.get("doi") or ""
        cited_by = work.get("cited_by_count") or 0
        wtype = work.get("type") or ""
        # Source (journal/venue): try primary_location.source.display_name, fallback raw_source_name
        source = ""
        pl = work.get("primary_location") or {}
        if isinstance(pl, dict):
            s = pl.get("source") or {}
            if isinstance(s, dict):
                source = s.get("display_name") or ""
            if not source:
                source = pl.get("raw_source_name") or ""
        lang = work.get("language") or ""
        # Authors and Institutions
        authors: List[str] = []
        insts: List[str] = []
        for a in work.get("authorships") or []:
            ad = a.get("author") or {}
            if isinstance(ad, dict):
                nm = ad.get("display_name")
                if nm:
                    authors.append(nm)
            for ins in a.get("institutions") or []:
                if isinstance(ins, dict):
                    nm = ins.get("display_name")
                    if nm:
                        insts.append(nm)
        authors_str = ", ".join(_uniq_preserve(authors))
        insts_str = ", ".join(_uniq_preserve(insts))
        # Counts and relationships
        cites = work.get("referenced_works_count")
        if cites is None:
            cites = len(work.get("referenced_works") or [])
        related_to = len(work.get("related_works") or [])
        # OA status
        oa = work.get("open_access") or {}
        oa_status = ""
        if isinstance(oa, dict):
            oa_status = oa.get("oa_status") or ("open" if oa.get("is_oa") else "closed" if oa.get("is_oa") is not None else "")
        # Topic hierarchy from primary_topic
        topic = subfield = field = domain = ""
        pt = work.get("primary_topic") or {}
        if isinstance(pt, dict):
            topic = pt.get("display_name") or ""
            sf = pt.get("subfield") or {}
            if isinstance(sf, dict):
                subfield = sf.get("display_name") or ""
            fld = pt.get("field") or {}
            if isinstance(fld, dict):
                field = fld.get("display_name") or ""
            dom = pt.get("domain") or {}
            if isinstance(dom, dict):
                domain = dom.get("display_name") or ""
        # FWCI and percentile
        fwci = work.get("fwci")
        percentile = ""
        cnorm = work.get("citation_normalized_percentile") or {}
        if isinstance(cnorm, dict):
            val = cnorm.get("value")
            if isinstance(val, (int, float)):
                percentile = f"{val*100:.2f}"
        rows.append(
            {
                "id": work_id,
                "title": title,
                "year": year,
                "type": wtype,
                "source": source,
                "authors": authors_str,
                "institutions": insts_str,
                "language": lang,
                "cites": cites,
                "doi": doi,
                "cited_by_count": cited_by,
                "related_to": related_to,
                "fwci": fwci if fwci is not None else "",
                "citation_percentile": percentile,
                "topic": topic,
                "subfield": subfield,
                "field": field,
                "domain": domain,
                "open_access_status": oa_status,
            }
        )
    return rows


def build_edges(works: List[Dict]) -> List[Dict[str, str]]:
    """Build a list of citation edges limited per paper."""
    edges: List[Dict[str, str]] = []
    for work in works:
        source_id = work.get("id")
        if not source_id:
            continue
        references = work.get("referenced_works") or []
        for target_id in references[:MAX_REFERENCES_PER_PAPER]:
            if target_id:
                edges.append({"source_id": source_id, "target_id": target_id})
    return edges


def write_csv(path: str, fieldnames: List[str], rows: List[Dict[str, str]]) -> None:
    """Write rows to CSV using the standard library."""
    with open(path, "w", newline="", encoding="utf-8") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def _openalex_to_compact_id(openalex_url: str) -> str:
    """Convert a full OpenAlex URL to the compact form 'openalex:WXXXX'."""
    if not openalex_url:
        return ""
    if openalex_url.startswith("openalex:"):
        return openalex_url
    # Expected format: https://openalex.org/W123...
    wid = openalex_url.rsplit("/", 1)[-1]
    if not wid:
        return ""
    return f"openalex:{wid}"


def fetch_referenced_metadata(target_ids: List[str]) -> Dict[str, Dict]:
    """Fetch metadata for referenced works using per-ID requests.

    Returns a dict keyed by full OpenAlex URL (https://openalex.org/W...)
    mapping to a minimal metadata dict: {id, display_name, concepts}.
    """
    id_map: Dict[str, Dict] = {}
    if not target_ids:
        return id_map

    import time

    unique_targets = list(dict.fromkeys(target_ids))
    for idx, t in enumerate(unique_targets, 1):
        wid = t.rsplit("/", 1)[-1]
        if not wid:
            continue
        url = f"{BASE_URL}/{wid}"
        data = fetch_json(url, params={"select": "id,display_name,concepts"})
        if data:
            oid = data.get("id") or t
            id_map[oid] = {
                "id": oid,
                "display_name": data.get("display_name") or "",
                "concepts": data.get("concepts") or [],
            }
        # Throttle slightly to be polite
        if idx % 10 == 0:
            time.sleep(0.2)
    return id_map


def top_level_discipline(concepts: List[Dict]) -> str:
    """Pick the most relevant broad discipline (level==0) from concepts.

    Fallbacks:
    - if no level 0 concept exists, use the highest-score concept's display_name.
    - if no concepts, return 'Unknown'.
    """
    if not concepts:
        return "Unknown"
    level0 = [c for c in concepts if c.get("level") == 0]
    chosen = None
    if level0:
        # Pick with highest score if available
        chosen = max(level0, key=lambda c: c.get("score", 0) or 0)
        return (chosen.get("display_name") or "Unknown").strip()
    # If no broad discipline is present, mark as Unknown (avoid narrow topics as disciplines)
    return "Unknown"


def main() -> None:
    # Step 1: fetch the seed works for the configured keyword.
    print(f"Fetching up to {MAX_PAPERS} works for keyword: '{KEYWORD}'")
    works = fetch_seed_works(KEYWORD, MAX_PAPERS)
    if not works:
        print("No works retrieved. Exiting.")
        return

    # Step 2: write the nodes CSV with metadata for each seed paper.
    node_rows = prepare_node_rows(works)
    write_csv(
        "nodes.csv",
        [
            "id",
            "title",
            "year",
            "type",
            "source",
            "authors",
            "institutions",
            "language",
            "cites",
            "doi",
            "cited_by_count",
            "related_to",
            "fwci",
            "citation_percentile",
            "topic",
            "subfield",
            "field",
            "domain",
            "open_access_status",
        ],
        node_rows,
    )
    print(f"Saved {len(node_rows)} nodes to nodes.csv")

    # Step 3: build a lightweight set of citation edges.
    edges = build_edges(works)
    write_csv("edges.csv", ["source_id", "target_id"], edges)
    print(f"Saved {len(edges)} edges to edges.csv")

    # Step 4 (opzionale): arricchire riferimenti con disciplina e generare
    # conteggi per disciplina per ogni seed work.
    if COMPUTE_DISCIPLINES and edges:
        print("Fetching disciplines for referenced works (batched)…")
        all_targets = [e["target_id"] for e in edges]
        meta_map = fetch_referenced_metadata(all_targets)

        # Build per-edge annotated list
        annotated_edges: List[Dict[str, str]] = []
        for e in edges:
            tgt_meta = meta_map.get(e["target_id"]) or {}
            discipline = top_level_discipline(tgt_meta.get("concepts", []))
            annotated_edges.append(
                {
                    "source_id": e["source_id"],
                    "target_id": e["target_id"],
                    "target_title": tgt_meta.get("display_name", ""),
                    "discipline": discipline,
                }
            )

        write_csv(
            "references_with_disciplines.csv",
            ["source_id", "target_id", "target_title", "discipline"],
            annotated_edges,
        )
        print(
            f"Saved {len(annotated_edges)} rows to references_with_disciplines.csv"
        )

        # Build discipline counts per source_id
        # Collect all disciplines to define columns
        disciplines = sorted(
            {row["discipline"] for row in annotated_edges if row.get("discipline")}
        )
        # Index by source
        from collections import defaultdict

        counts = defaultdict(lambda: {d: 0 for d in disciplines})
        for row in annotated_edges:
            src = row["source_id"]
            disc = row["discipline"] or "Unknown"
            if disc not in counts[src]:
                # In case a discipline appears after initialization
                for s in counts.values():
                    s.setdefault(disc, 0)
                disciplines = sorted(set(disciplines + [disc]))
                counts[src].setdefault(disc, 0)
            counts[src][disc] += 1

        fieldnames = ["source_id"] + disciplines
        rows = []
        for src, cdict in counts.items():
            row = {"source_id": src}
            row.update({d: cdict.get(d, 0) for d in disciplines})
            rows.append(row)

        write_csv("discipline_counts.csv", fieldnames, rows)
        print(
            f"Saved {len(rows)} rows with {len(disciplines)} discipline columns to discipline_counts.csv"
        )


if __name__ == "__main__":
    main()
