#!/usr/bin/env python3
"""One-shot migration: <name>.html → <name>/index.html with canvas shell.
Originals are NOT deleted (per user request)."""
import os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))

PROJECTS = ["drawaline", "6am", "spectathesis", "specta", "pixelpushing",
            "corpomacchina", "booksimage", "monolite", "duedadi", "blank",
            "karinswork", "totem", "notprevented", "whitecanvas",
            "iperstizioni", "249"]

# All project slugs that should be rewritten as folder URLs
ALL_PROJECT_SLUGS = ["capsule"] + PROJECTS

HEAD_TEMPLATE = """<!doctype html>
<html lang="en">
  <head>
    <link rel="preconnect" href="https://commons.wikimedia.org" crossorigin />
    <link rel="preconnect" href="https://upload.wikimedia.org" crossorigin />
    <meta charset="UTF-8" />
    <meta name="description" content="{title} — Enrico Isidori" />
    <meta name="author" content="Enrico Isidori" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta
      name="viewport"
      content="width=device-width, height=device-height, initial-scale=1.0, viewport-fit=cover"
    />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <title>{title} — Enrico Isidori</title>
    <link rel="icon" type="image/png" href="../asset/svg/cyan.png" />
    <link rel="shortcut icon" type="image/png" href="../asset/svg/cyan.png" />
    <link rel="apple-touch-icon" href="../asset/svg/cyan.png" />
    <link rel="stylesheet" href="https://fonts.cdnfonts.com/css/helvetica-lt-narrow" />
    <link rel="stylesheet" href="https://use.typekit.net/vhk8wid.css" />
    <link rel="stylesheet" href="../style.css" />
    <script>
      window.__alephPrefetch = fetch(
        "https://commons.wikimedia.org/w/api.php?" +
          new URLSearchParams({{
            action: "query", generator: "random", grnnamespace: "6",
            grnlimit: "50", prop: "imageinfo", iiprop: "url|mime",
            iiurlwidth: "64", format: "json", origin: "*",
          }})
      );
    </script>
  </head>
"""

BODY_TEMPLATE = """  <body class="has-canvas">
    <div id="aleph-stage">
      <canvas id="aleph-canvas"></canvas>
    </div>

    <div id="content-scroll">
{content}
      <div class="spacer5"></div>
    </div>

    <script src="../script.js"></script>
    <script src="../aleph.js"></script>
    <script>
      document.addEventListener("DOMContentLoaded", () => {{
        if (sessionStorage.getItem("allowAutoplay")) {{
          document.querySelectorAll("video").forEach((v) => v.play().catch(() => {{}}));
          sessionStorage.removeItem("allowAutoplay");
        }}
      }});
    </script>
  </body>
</html>
"""


def extract_body(html):
    m = re.search(r"<body[^>]*>(.*?)</body>", html, re.DOTALL | re.IGNORECASE)
    if not m:
        return html
    return m.group(1)


def extract_title(body):
    """Pulls the page title from the topnav header.
    Looks for: <a class="btn closebtn" href="home.html">Close</a><br /> TITLE
    """
    m = re.search(
        r'<a[^>]*closebtn[^>]*>Close</a>\s*<br\s*/?>\s*([^<\n]+)',
        body,
        re.IGNORECASE,
    )
    if m:
        return m.group(1).strip().rstrip(",").strip()
    return ""


def rewrite_paths(body):
    # Path globali: asset/, style.css, script.js → ../asset/, etc.
    body = re.sub(r'(["\'])asset/', r'\1../asset/', body)
    body = re.sub(r'(["\'])style\.css', r'\1../style.css', body)
    body = re.sub(r'(["\'])script\.js', r'\1../script.js', body)
    body = re.sub(r'(["\'])home\.html', r'\1../home.html', body)
    body = re.sub(r'(["\'])about\.html', r'\1../about/', body)

    # Project slug links: <slug>.html → ../<slug>/
    for slug in ALL_PROJECT_SLUGS:
        # Match href="<slug>.html" and src="<slug>.html"
        body = re.sub(
            rf'(["\']){re.escape(slug)}\.html',
            rf'\1../{slug}/',
            body,
        )

    # Also rewrite specta.pdf and similar root files: ./asset/... handled above,
    # but bare *.pdf or *.html references at root level need ../
    # Only if not already starting with ../ or http or mailto or #
    def root_ref(m):
        prefix, val = m.group(1), m.group(2)
        if val.startswith(("http://", "https://", "mailto:", "#", "../", "/", "./")):
            return m.group(0)
        # Skip already-rewritten asset/style/script
        return f'{prefix}../{val}'

    body = re.sub(
        r'(["\'])([\w\-]+\.(?:pdf|html|gif|jpg|png|mp4|webm|webp))(?=["\'])',
        root_ref,
        body,
    )

    return body


def strip_jquery(body):
    return re.sub(
        r'<script\s+src="https://ajax\.googleapis\.com/ajax/libs/jquery[^"]*"[^>]*>\s*</script>',
        "",
        body,
        flags=re.IGNORECASE,
    )


def strip_old_script_tag(body):
    """Removes <script src="../script.js"></script> tags from body content
    (we add them in the template)."""
    return re.sub(
        r'<script\s+src="\.\./script\.js"[^>]*>.*?</script>',
        "",
        body,
        flags=re.DOTALL | re.IGNORECASE,
    )


def remove_toprectsigle(body):
    return re.sub(
        r'<div\s+id="toprectsigle"[^>]*>\s*</div>\s*',
        "",
        body,
        flags=re.IGNORECASE,
    )


def wrap_header_for_canvas(body):
    """Wraps the <header id="topnav"> children to keep close + title visible.
    Most original files have:
        <header id="topnav">
          <div class="col-12">
            <a class="btn closebtn" href="../home.html">Close</a><br />
            TITLE
          </div>
        </header>
    No structural change needed; we keep it as-is.
    """
    return body


def migrate_one(slug):
    src = os.path.join(ROOT, f"{slug}.html")
    if not os.path.exists(src):
        print(f"SKIP {slug}: source not found")
        return
    with open(src, "r", encoding="utf-8") as f:
        html = f.read()

    body = extract_body(html)
    title = extract_title(body) or slug

    body = strip_jquery(body)
    body = remove_toprectsigle(body)
    body = rewrite_paths(body)
    body = strip_old_script_tag(body)

    # Indent
    body_indented = "\n".join(
        ("      " + line) if line.strip() else line for line in body.splitlines()
    )

    out_dir = os.path.join(ROOT, slug)
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "index.html")

    new_html = HEAD_TEMPLATE.format(title=title) + BODY_TEMPLATE.format(
        content=body_indented
    )
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(new_html)
    print(f"OK {slug} → {slug}/index.html  (title: {title!r})")


if __name__ == "__main__":
    for slug in PROJECTS:
        migrate_one(slug)
