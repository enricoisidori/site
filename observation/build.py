"""Regenerate the standalone HTML. No build is needed to open or publish it."""
from pathlib import Path
import json

root = Path(__file__).resolve().parent
worker = (root / 'vision-worker.js').read_text()
app = (root / 'app.js').read_text()
# JSON protects the worker source from HTML closing-script sequences.
scripts = '<script id="vision-source" type="application/json">' + json.dumps(worker).replace('<', '\\u003c') + '</script>\n'
scripts += '<script>\n(async () => {\n' + app.replace('</script', '<\\/script') + '\n})();\n</script>'
(root / 'index.html').write_text((root / 'index.template.html').read_text().replace('<!-- OBSERVATION_SCRIPTS -->', scripts))
