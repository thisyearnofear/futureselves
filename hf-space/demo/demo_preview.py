"""
demo_preview.py — Render the full demo flow as static HTML files.

Run with:  /Library/Frameworks/Python.framework/Versions/3.14/bin/python3.14 demo_preview.py

Writes 4 files to demo/preview/:
  - 01-empty-state.html        (first screen, before demo button)
  - 02-demo-transmission.html  (after clicking "Try Maya's example")
  - 03-history-tab.html        (memory log full)
  - 04-architecture-tab.html   (pipeline + persona card + Modal + trace)

These are the visual states a judge sees. Open in a browser to
audit the look before recording the demo video.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import app
from app import AppState
from demo.maya import build_maya_demo


OUT_DIR = Path(__file__).parent / "preview"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def _page_wrap(title: str, body_html: str) -> str:
    """Wrap the rendered state in a full HTML document with the same CSS the Space uses."""
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} — FutureSelves demo preview</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap">
<style>{app.CSS}</style>
</head>
<body>
<div class="gradio-container">
{body_html}
</div>
</body>
</html>"""


def main():
    # 1. Empty state (before demo button)
    s_empty = AppState()
    html1 = _page_wrap("Empty state", app._render_home(s_empty))
    (OUT_DIR / "01-empty-state.html").write_text(html1)
    print(f"wrote {OUT_DIR / '01-empty-state.html'}")

    # 2. After demo button — fully loaded Maya
    s = AppState()
    bundle = build_maya_demo()
    s.persona = bundle.persona
    s.onboarded = True
    s.onboard_step = 3
    s.recent_transmissions = list(bundle.past_transmissions)
    s.recent_choices = list(bundle.past_choices)
    s.recent_responses = list(bundle.past_responses)
    s.checked_in = True
    s.check_in_word = bundle.check_in_word
    s.check_in_note = bundle.check_in_note
    s.today_cast = bundle.today_cast
    s.today_transmission = bundle.today_transmission
    s.today_audio = app._stage_static_audio(bundle.today_audio_path) or bundle.today_audio_path
    s.generation_done = True
    s.generating = False

    html2 = _page_wrap("Demo transmission", app._render_transmission(s))
    (OUT_DIR / "02-demo-transmission.html").write_text(html2)
    print(f"wrote {OUT_DIR / '02-demo-transmission.html'}")

    # 3. History tab
    html3 = _page_wrap("History", app._render_history(s))
    (OUT_DIR / "03-history-tab.html").write_text(html3)
    print(f"wrote {OUT_DIR / '03-history-tab.html'}")

    # 4. Architecture tab — read raw from app.py
    # (We can render it via _render_history then patch, but easier to dump the static HTML block)
    arch_html = f"""<div class="gradio-container">
{app._render_home(s)}
</div>"""
    # Just dump the persona card + pipeline diagram inline
    arch = f"""
<div class="arch-pane">
  <div class="arch-h">signal pipeline · ~3.1B total params</div>
<span class="k">nemotron-parse</span>  <span class="v">·</span>  note extraction (&lt;1B)  <span class="k">·</span>  <span class="v">nvidia</span>
<span class="k">minicpm-2.5</span>      <span class="v">·</span>  transmission generation (~2.5B)  <span class="k">·</span>  <span class="v">openbmb</span>
<span class="k">piper / kokoro-82m</span> <span class="v">·</span>  voice synthesis (&lt;100M)  <span class="k">·</span>  <span class="v">on-device</span>

every signal stays on the device. no cloud. no upload. no api bill.
</div>

<div class="arch-pane">
  <div class="arch-h">prize targets</div>
backyard ai · openbmb · nvidia nemotron · tiny titan · best agent · off brand · bonus quest champion
</div>

<div class="arch-pane">
  <div class="arch-h">demo persona · maya</div>
{app._render_persona_card()}
</div>

<div class="arch-pane">
  <div class="arch-h">open agent trace · sharing is caring</div>
the full transmission chain — system prompt, user prompt, raw LLM output, parsed JSON, note insights, duration — is logged to <a href="traces/agent-trace.jsonl">traces/agent-trace.jsonl</a>. open for anyone to audit the agent's decisions end-to-end.
</div>

<div class="arch-pane">
  <div class="arch-h">modal · serverless compute for the persona summarizer</div>
persona summaries are pre-computed on modal's serverless GPU (modal_app.py). the function takes a serialized persona + 3+ day history and returns a 1-paragraph narrative summary. <a href="traces/modal_app.py">see traces/modal_app.py</a>.
</div>
"""
    html4 = _page_wrap("Architecture", arch)
    (OUT_DIR / "04-architecture-tab.html").write_text(html4)
    print(f"wrote {OUT_DIR / '04-architecture-tab.html'}")

    print(f"\nOpen {OUT_DIR}/02-demo-transmission.html in a browser to see the demo flow.")


if __name__ == "__main__":
    main()
