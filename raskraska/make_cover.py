"""Render the square catalog cover from the first authored coloring sheet."""
from html import escape
from io import BytesIO
import json
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

from test_browser import chromium_path

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT.parent / 'raskraska.webp'


def cover_svg(scene, palette):
    picture = ''.join(
        f'<path d="{escape(area["d"], quote=True)}" fill="{palette[area["color"]]}"/>'
        for area in scene['areas']
    )
    lines = ''.join(f'<path d="{escape(d, quote=True)}"/>' for d in scene['details'])
    swatches = ''.join(
        f'<circle cx="{106 + 84*i}" cy="690" r="31" fill="{palette[name]}"/>'
        f'<path d="M{94 + 84*i} 682q5-10 14-10" stroke="#fff" stroke-width="5" opacity=".67"/>'
        for i, name in enumerate(palette)
    )
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <linearGradient id="wash" x2="1" y2="1" gradientUnits="objectBoundingBox">
      <stop stop-color="#dcc6fa"/><stop offset="1" stop-color="#fce3d2"/>
    </linearGradient>
    <pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse">
      <circle cx="9" cy="9" r="1.35" fill="#dccbe8"/>
    </pattern>
  </defs>
  <rect width="800" height="800" fill="url(#wash)"/>
  <circle cx="92" cy="128" r="123" fill="#f4e7fa" opacity=".65"/>
  <circle cx="770" cy="543" r="158" fill="#fce8c6" opacity=".72"/>
  <path d="M94 65v61m-30-31h60M713 87v66m-31-33h62M55 498v61m-28-30h56M749 589v54m-26-27h52" fill="none" stroke="#fff9fa" stroke-width="10" stroke-linecap="round"/>
  <g transform="rotate(-7 400 340)">
    <rect x="104" y="127" width="602" height="474" rx="54" fill="#79599d" opacity=".19"/>
    <rect x="93" y="104" width="602" height="482" rx="54" fill="white" stroke="#f9f0ff" stroke-width="8"/>
    <rect x="112" y="135" width="565" height="431" rx="35" fill="url(#dots)"/>
    <path d="M302 91q32-9 102-1l-4 36q-53-8-104-2z" fill="#fcd472" opacity=".9"/>
    <svg x="119" y="143" width="550" height="410" viewBox="0 0 480 360">
      <g stroke="#48375c" stroke-width="4.1" stroke-linecap="round" stroke-linejoin="round">{picture}</g>
      <g fill="none" stroke="#6f5a7c" stroke-width="2.9" stroke-linecap="round" stroke-linejoin="round">{lines}</g>
    </svg>
  </g>
  <rect x="57" y="651" width="686" height="102" rx="38" fill="#846287" opacity=".18"/>
  <rect x="57" y="638" width="686" height="102" rx="38" fill="#fff6ff" stroke="#f7e5f4" stroke-width="5"/>
  <g stroke-linecap="round">{swatches}</g>
</svg>'''


def main():
    source = json.loads((ROOT / 'src/scenes.json').read_text(encoding='utf-8'))
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path=chromium_path(pw), args=['--no-sandbox'])
        try:
            page = browser.new_page(viewport={'width':800, 'height':800}, device_scale_factor=1)
            # Read the exact RGB choices from the built standalone UI, rather than keeping a second palette.
            page.goto((ROOT / 'index.html').as_uri())
            palette = page.locator('#paints button').evaluate_all('''nodes => Object.fromEntries(nodes.map(
                el => [el.dataset.color, el.style.getPropertyValue('--paint')]))''')
            assert all(area['color'] in palette for area in source[0]['areas'])
            page.set_content('<style>body{margin:0}svg{display:block}</style>' + cover_svg(source[0], palette))
            image = Image.open(BytesIO(page.screenshot())).convert('RGB')
            assert image.size == (800, 800)
            image.save(OUTPUT, 'WEBP', quality=89, method=6)
            print(f'Built: {OUTPUT} ({OUTPUT.stat().st_size} bytes)')
        finally:
            browser.close()


if __name__ == '__main__':
    main()
