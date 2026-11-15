import { readFileSync } from 'node:fs'

const candidates = [
  { id: 'a-vertex',    name: 'A · Vertex',    concept: 'Angle brackets converge on one symbol node — code, indexed.', dir: 'Direction 1 · Syntax geometry' },
  { id: 'b-prism',     name: 'B · Prism',     concept: 'Hexagonal brackets hold a node — every facet of the blueprint.', dir: 'Direction 1 · Syntax geometry' },
  { id: 'c-blueprint', name: 'C · Blueprint', concept: 'Dependency graph on drafting paper — the persisted blueprint.', dir: 'Direction 2 · Blueprint graph' },
  { id: 'd-map',       name: 'D · Map',       concept: 'Symbol-kind shapes wired by edges — a map of the codebase.', dir: 'Direction 2 · Blueprint graph' },
  { id: 'e-prompt',    name: 'E · Prompt',    concept: 'Terminal prompt with a live cursor — agent intelligence.', dir: 'Direction 3 · Terminal spark' },
  { id: 'f-stratum',   name: 'F · Stratum',   concept: 'Layered plates carrying a graph — depth, for depth’s sake.', dir: 'Direction 3 · Terminal spark' },
]

const b64 = (p) => readFileSync(p).toString('base64')
const W = 1600, H = 1060, cols = 3, rows = 2
const cw = 506, ch = 470, gx = 28, gy = 24
const x0 = (W - cols * cw - (cols - 1) * gx) / 2
const y0 = 148

let cells = ''
candidates.forEach((c, i) => {
  const cx = x0 + (i % cols) * (cw + gx)
  const cy = y0 + Math.floor(i / cols) * (ch + gy)
  const big = b64(`${c.id}-512.png`)
  const s48 = b64(`${c.id}-48.png`)
  cells += `
  <g transform="translate(${cx} ${cy})">
    <rect width="${cw}" height="${ch}" rx="18" fill="#1A212E" stroke="#2A3448" stroke-width="1.5"/>
    <image x="${cw / 2 - 130}" y="28" width="260" height="260" href="data:image/png;base64,${big}"/>
    <text x="${cw / 2}" y="322" text-anchor="middle" font-family="DejaVu Sans" font-size="25" font-weight="bold" fill="#EDEFF4">${c.name}</text>
    <text x="${cw / 2}" y="352" text-anchor="middle" font-family="DejaVu Sans" font-size="16" fill="#9AA7BC">${c.concept}</text>
    <text x="${cw / 2}" y="382" text-anchor="middle" font-family="DejaVu Sans" font-size="13" fill="#5F6C82" letter-spacing="1.5">${c.dir.toUpperCase()}</text>
    <image x="${cw / 2 - 83}" y="398" width="48" height="48" href="data:image/png;base64,${s48}"/>
    <image x="${cw / 2 + 9}" y="406" width="32" height="32" href="data:image/png;base64,${s48}"/>
    <text x="${cw / 2 + 62}" y="431" font-family="DejaVu Sans" font-size="13" fill="#5F6C82">48 / 32 px in the hub</text>
  </g>`
})

const sheet = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#0E1219"/>
  <text x="${W / 2}" y="72" text-anchor="middle" font-family="DejaVu Sans" font-size="38" font-weight="bold" fill="#F2F4F8">code-intel — icon directions</text>
  <text x="${W / 2}" y="106" text-anchor="middle" font-family="DejaVu Sans" font-size="17" fill="#8C99AE">Six candidates across three directions · A/B syntax geometry · C/D blueprint graph · E/F terminal spark</text>${cells}
</svg>`
console.log(sheet)
