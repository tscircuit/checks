# Repository guidance

New features do not necessarily justify adding a section to the README. Add or
expand README sections only when they materially improve the repository's overview
or essential usage guidance; do not add a section automatically for each feature.

## User-facing diagnostic messages

NEVER use IDs in error, warning, or other user-facing messages. Use only readable
names (component reference designators, pin names, net names, and named geometry).
Use the shared readable-name helpers. When no name exists, use an honest readable
label such as "unnamed via" or "unnamed bend"; NEVER fall back to an ID or append
one in parentheses/brackets. IDs are permitted only in structured diagnostic
reference fields, not message text. Test both named and unnamed cases.
