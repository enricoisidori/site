import ast, pathlib, re
src = pathlib.Path('tmp/pdfs/translate_cv_in_place.py').read_text()
tree = ast.parse(src)
replacements = next(ast.literal_eval(n.value) for n in tree.body if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'REPLACEMENTS' for t in n.targets))
for path in pathlib.Path('tmp/idml/Stories').glob('*.xml'):
    text = path.read_text()
    for italian, english in sorted(replacements.items(), key=lambda x: -len(x[0])):
        text = text.replace(italian, english)
    path.write_text(text)
