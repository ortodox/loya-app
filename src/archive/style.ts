// EX1: the LOA look for the archive (tokens from globals.css), light and dark, no web fonts – it must open offline.
export const archiveCss = `:root {
  --bg: #f4ece2; --surface: #fbf7f2; --line: #eadfd2; --field: #d9c9b6; --ink: #2a211d; --muted: #6b5b4e;
  --gold: #9c7a50; --accent: #7a5a36; --alert: #f6e3dc; --on-alert: #8a2e1e;
  --face-paper: #fbf7f2; --pen-dark: #141414; --pen-red: #e0001b; --pen-blue: #0050f0; --face-line: #9a8878;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #1e1814; --surface: #2a221d; --line: #3a2f28; --field: #806d5c; --ink: #f4ece2; --muted: #bfae9c;
    --gold: #c9a57a; --accent: #c9a57a; --alert: #4a2620; --on-alert: #f2b8a8; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.5 "Montserrat", -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }
main { max-width: 760px; margin: 0 auto; padding: 16px; display: flex; flex-direction: column; gap: 16px; }
h1, h2, h3, .brand { font-family: "Cormorant Garamond", Georgia, "Times New Roman", serif; font-weight: 500; margin: 0; }
h1 { font-size: 40px; line-height: 1.1; }
h2 { font-size: 26px; margin-bottom: 8px; }
h3 { font-size: 20px; margin: 12px 0 4px; }
p { margin: 4px 0; }
a { color: var(--accent); }
.brand { color: var(--gold); font-size: 22px; letter-spacing: .12em; }
.kicker { font-size: 12px; font-weight: 600; letter-spacing: .25em; text-transform: uppercase; color: var(--muted); }
.muted, .label { color: var(--muted); font-size: 14px; }
.label { font-weight: 600; margin-top: 10px; }
.back { display: inline-block; padding: 10px 0; text-decoration: none; font-weight: 500; }
.card { background: var(--surface); border-radius: 18px; padding: 16px; }
.box { border-radius: 18px; padding: 16px; }
.alert { background: var(--alert); color: var(--on-alert); }
.tag { font-family: "Montserrat", -apple-system, "Segoe UI", Roboto, Arial, sans-serif; vertical-align: middle; display: inline-block; border: 1px solid var(--field); border-radius: 999px; padding: 0 8px; font-size: 12px; font-weight: 600; color: var(--muted); }
.tag.alert { border: 0; color: var(--on-alert); }
.letters { display: flex; flex-wrap: wrap; gap: 6px; }
.letters a { min-width: 32px; text-align: center; padding: 6px; border: 1px solid var(--field); border-radius: 999px; text-decoration: none; }
.list { list-style: none; margin: 0; padding: 0; }
.list li + li { border-top: 1px solid var(--line); }
.list a { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; padding: 12px 4px; color: var(--ink); text-decoration: none; }
.list .name { font-weight: 600; flex-basis: 100%; }
.visit { border-top: 1px solid var(--line); padding: 8px 0; }
.visit:first-of-type { border-top: 0; }
.items { margin: 4px 0; padding-left: 20px; }
.photos { display: flex; flex-wrap: wrap; gap: 8px; margin: 6px 0; }
.photos img { width: 120px; height: 120px; object-fit: cover; border-radius: 14px; display: block; }
.scheme svg { width: 220px; max-width: 100%; height: auto; border-radius: 14px; background: var(--face-paper); }
dl { margin: 0; }
.row { padding: 6px 0; border-bottom: 1px solid var(--line); }
.row:last-child { border-bottom: 0; }
dt { color: var(--muted); font-size: 14px; }
dd { margin: 0; white-space: pre-wrap; }
.text { white-space: pre-wrap; }
.docs { margin: 4px 0; padding-left: 20px; }
.footer { text-align: center; padding: 16px 0; }
@media print { body { background: #fff; } .card { break-inside: avoid; } .letters, .back { display: none; } }
`;
