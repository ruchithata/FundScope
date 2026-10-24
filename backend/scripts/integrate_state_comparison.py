from pathlib import Path

app_path = Path("frontend/src/App.jsx")
if not app_path.is_file():
    raise SystemExit("Run from the FundScope repository root: frontend/src/App.jsx not found.")

app = app_path.read_text(encoding="utf-8")
original = app

import_anchor = 'import ProvenanceQuality from "./components/ProvenanceQuality";'
import_line = 'import StateComparison from "./components/StateComparison";'
if import_line not in app:
    if app.count(import_anchor) != 1:
        raise SystemExit("Could not uniquely locate the App.jsx import insertion point.")
    app = app.replace(import_anchor, import_anchor + "\n" + import_line, 1)

nav_anchor = '        <a className="nav" href="#provenance">'
nav_block = "        <a className=\"nav\" href=\"#state-comparison\">\n          State comparison\n        </a>\n"
if 'href="#state-comparison"' not in app:
    if app.count(nav_anchor) != 1:
        raise SystemExit("Could not uniquely locate the sidebar insertion point.")
    app = app.replace(nav_anchor, nav_block + nav_anchor, 1)

render_line = '        <StateComparison states={states} years={years} categories={cats} />'
if render_line not in app:
    render_anchor = '        <section className="block" id="provenance">'
    if app.count(render_anchor) != 1:
        raise SystemExit("Could not uniquely locate the comparison section insertion point.")
    app = app.replace(render_anchor, render_line + "\n\n" + render_anchor, 1)

if app == original:
    print("State comparison integration already exists; App.jsx was not changed.")
else:
    app_path.write_text(app, encoding="utf-8")
    print("Integrated StateComparison into frontend/src/App.jsx.")
    print("Review with: git diff -- frontend/src/App.jsx")
