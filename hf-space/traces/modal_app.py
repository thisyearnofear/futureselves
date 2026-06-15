"""modal_app.py — Modal function for FutureSelves persona summarization.

Run locally with:
    modal run modal_app.py --persona-json traces/maya-persona.json

Deploy as a Modal web endpoint with:
    modal deploy modal_app.py

The function takes a serialized persona (with their 3+ day history of
transmissions, choices, and responses) and returns a 1-paragraph
narrative summary. The summary is shipped in traces/persona-summaries.json
and surfaced in the Space's Architecture tab.

This is the load-bearing Modal use for Build Small: the demo persona
(Maya) and any future users with enough history get a richer persona
description that improves the transmission quality.
"""

import modal
import json

app = modal.App("futureselves-persona-summarizer")

# Pin to a small model that fits in Modal's free tier
SUMMARY_MODEL = "openbmb/MiniCPM-2.5-sft-bf16"


@app.function(
    gpu="T4",
    timeout=180,
    image=modal.Image.debian_slim().pip_install(
        "torch>=2.2", "transformers>=4.40", "accelerate>=0.28", "sentencepiece>=0.2",
    ),
)
def summarize_persona(persona: dict, transmissions: list[dict], choices: list[dict]) -> dict:
    """Generate a 1-paragraph narrative summary of who this person is.

    The summary is rendered in the Space's Architecture tab as the
    "persona card" — a single paragraph that helps judges and
    curious users understand the depth the product handles.

    Returns: {"summary": str, "model": str, "duration_ms": int}
    """
    import time
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer

    start = time.time()
    tokenizer = AutoTokenizer.from_pretrained(SUMMARY_MODEL, trust_remote_code=True)
    model = AutoModelForCausalLM.from_pretrained(
        SUMMARY_MODEL, trust_remote_code=True,
        torch_dtype=torch.float16, device_map="auto", attn_implementation="sdpa",
    )
    model.eval()

    # Build a prompt from persona + history
    t_summary = "\n".join(
        f"- {t.get('date_key', '?')}: {t.get('title', '?')} ({t.get('cast_member', '?')})"
        for t in transmissions
    )
    c_summary = "\n".join(
        f"- {c.get('date_key', '?')}: chose '{c.get('choice', '?')}' — {c.get('prompt', '?')[:120]}"
        for c in choices
    )
    prompt = f"""Summarize this person's current chapter in 2-3 sentences.
Voice: intimate, specific, unpolished. Reference what they are avoiding
and what they keep reaching toward. Do not coach. Do not flatter.

Persona:
- Name: {persona.get('name', '?')}
- Chapter: {persona.get('current_chapter', '?')}
- Arc: {persona.get('primary_arc', '?')}
- Avoiding: {persona.get('avoiding', '?')}
- Afraid won't happen: {persona.get('afraid_wont_happen', '?')}

Recent transmissions:
{t_summary or 'none'}

Recent choices:
{c_summary or 'none'}

Summary:"""

    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    with torch.no_grad():
        outputs = model.generate(
            **inputs, max_new_tokens=200, temperature=0.7, top_p=0.9,
            do_sample=True, pad_token_id=tokenizer.pad_token_id or tokenizer.eos_token_id,
        )
    decoded = tokenizer.decode(outputs[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True).strip()
    duration_ms = int((time.time() - start) * 1000)
    return {"summary": decoded[:600], "model": SUMMARY_MODEL, "duration_ms": duration_ms}


@app.local_entrypoint()
def main(persona_json: str = "traces/maya-persona.json"):
    """Local entry point: load persona, call the function, write summary."""
    with open(persona_json) as f:
        data = json.load(f)
    result = summarize_persona.remote(
        persona=data.get("persona", {}),
        transmissions=data.get("transmissions", []),
        choices=data.get("choices", []),
    )
    out_path = "traces/persona-summaries.json"
    existing = []
    if os.path.exists(out_path):
        with open(out_path) as f:
            existing = json.load(f)
    existing.append({**result, "persona_name": data.get("persona", {}).get("name", "?"), "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
    with open(out_path, "w") as f:
        json.dump(existing, f, indent=2)
    print(f"✓ Wrote summary for {data.get('persona', {}).get('name', '?')} ({result['duration_ms']}ms)")
    print(f"  {result['summary'][:200]}...")
