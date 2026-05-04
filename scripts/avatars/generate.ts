// Run with: npx tsx scripts/avatars/generate.ts
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
if (!REPLICATE_API_TOKEN) {
  console.error("Set REPLICATE_API_TOKEN");
  process.exit(1);
}

const archetypes = [
  {
    name: "future_self",
    prompt: "Portrait of a person who looks like they have been through something and come out the other side, slightly different but recognizably the same species of human. Expression: calm certainty, knowing eyes, gentle but unshakeable. Lighting: golden hour, warm but clear. Color palette: warm amber, soft gold. Age: 5-10 years older than the viewer imagines themselves. Background: soft gradient, no distracting details. High quality, photographic, emotionally resonant, professional portrait photography. The face should feel like a real person — specific, not generic. Aspect ratio 1:1, centered composition.",
  },
  {
    name: "future_partner",
    prompt: "Portrait of someone whose face you would want to see first thing in the morning and last thing at night. Expression: complex, layered, occasionally challenging, deeply intimate. Lighting: warm, intimate, soft focus. Color palette: warm amber, soft rose, candlelight tones. Age: similar age to the user. Background: intimate, slightly abstract, warm. High quality, photographic, emotionally resonant, professional portrait photography. The face should feel like a real person — specific, not generic. Aspect ratio 1:1, centered composition.",
  },
  {
    name: "future_mentor",
    prompt: "Portrait of someone who commands a room without raising their voice, dignified but approachable. Expression: proud, measured, slightly formal but generous. Lighting: clean studio lighting, subtle rim light. Color palette: cool slate, silver accents. Age: late 50s to mid 60s. Background: clean, professional, minimal. High quality, photographic, emotionally resonant, professional portrait photography. The face should feel like a real person — specific, not generic. Aspect ratio 1:1, centered composition.",
  },
  {
    name: "shadow",
    prompt: "Portrait of someone who sees through every excuse, compassionate but not comforting. Expression: confrontational gaze, dramatic, intense but not cruel. Lighting: dramatic chiaroscuro, high contrast. Color palette: deep purple, desaturated, shadow-dominant. Age: same age as user. Background: dark, minimal, mysterious. High quality, photographic, emotionally resonant, professional portrait photography. The face should feel like a real person — specific, not generic. Aspect ratio 1:1, centered composition.",
  },
  {
    name: "alternate_self",
    prompt: "Portrait of someone who looks like they made every choice you did not, haunting not villainous. Expression: haunting, not villainous, just different. Lighting: ethereal, slightly surreal, dreamlike. Color palette: shifting, iridescent hints. Age: same age as user, but weathered differently. Background: dreamlike, transitional, slightly surreal. High quality, photographic, emotionally resonant, professional portrait photography. The face should feel like a real person — specific, not generic. Aspect ratio 1:1, centered composition.",
  },
  {
    name: "future_best_friend",
    prompt: "Portrait of someone who would make you laugh in a hospital waiting room, effortlessly warm. Expression: mischievous warmth, nostalgic, slightly irreverent. Lighting: natural daylight, candid feel. Color palette: warm earth tones, comfortable. Age: similar age to the user. Background: cozy, lived-in, slightly out of focus. High quality, photographic, emotionally resonant, professional portrait photography. The face should feel like a real person — specific, not generic. Aspect ratio 1:1, centered composition.",
  },
  {
    name: "future_employee",
    prompt: "Portrait of someone who works for you and is genuinely grateful, specific and professional. Expression: grateful, specific, professional pride. Lighting: bright, optimistic, clear. Color palette: clean whites, accent of warm gold. Age: late 20s to mid 30s. Background: modern workspace, slightly blurred. High quality, photographic, emotionally resonant, professional portrait photography. The face should feel like a real person — specific, not generic. Aspect ratio 1:1, centered composition.",
  },
  {
    name: "future_customer",
    prompt: "Portrait of someone whose life was changed by something you built, authentic and specific. Expression: changed, grateful, real. Lighting: natural, documentary feel. Color palette: warm neutrals. Age: varies. Background: everyday setting, real-world. High quality, photographic, emotionally resonant, professional portrait photography. The face should feel like a real person — specific, not generic. Aspect ratio 1:1, centered composition.",
  },
  {
    name: "future_child",
    prompt: "Portrait of a young adult who carries something of you in their face but is entirely their own person. Expression: rare, gentle, devastating, a little vulnerable. Lighting: soft, early morning quality. Color palette: pale, tender, soft focus. Age: early 20s. Background: dreamlike, gentle blur. High quality, photographic, emotionally resonant, professional portrait photography. The face should feel like a real person — specific, not generic. Aspect ratio 1:1, centered composition.",
  },
  {
    name: "future_stranger",
    prompt: "Portrait of someone you almost recognize but can't place, familiar and foreign simultaneously. Expression: unknown, moving, uncanny. Lighting: slightly desaturated, liminal. Color palette: muted, transitional. Age: ambiguous. Background: transitional space, train station or airport quality. High quality, photographic, emotionally resonant, professional portrait photography. The face should feel like a real person — specific, not generic. Aspect ratio 1:1, centered composition.",
  },
  {
    name: "the_ceiling",
    prompt: "Portrait of someone who got everything they wanted and found out it was a room with no doors. Expression: tired, settled, almost satisfied. Lighting: flat, fluorescent-adjacent, institutional. Color palette: muted beige, grey. Age: mid 50s. Background: comfortable but confining. High quality, photographic, emotionally resonant, professional portrait photography. The face should feel like a real person — specific, not generic. Aspect ratio 1:1, centered composition.",
  },
  {
    name: "the_resentee",
    prompt: "Portrait of someone keeping a precise mental ledger, sharp and specific. Expression: sharp, specific, keeping score. Lighting: harsh side lighting, angular shadows. Color palette: cool steel, bitter green. Age: mid 40s. Background: sparse, counting-house quality. High quality, photographic, emotionally resonant, professional portrait photography. The face should feel like a real person — specific, not generic. Aspect ratio 1:1, centered composition.",
  },
  {
    name: "the_grandfather",
    prompt: "Portrait of someone who has lived long enough to see the cost of wisdom, proud but drained. Expression: proud, drained, no more road left. Lighting: late afternoon, long shadows. Color palette: warm but fading, sepia-adjacent. Age: late 70s. Background: a study, a porch, somewhere with history. High quality, photographic, emotionally resonant, professional portrait photography. The face should feel like a real person — specific, not generic. Aspect ratio 1:1, centered composition.",
  },
  {
    name: "the_exhausted_winner",
    prompt: "Portrait of someone who climbed the mountain and found nothing at the top, wealthy and hollowed. Expression: wealthy, hollowed, nothing left to want. Lighting: bright but cold, luxury lighting. Color palette: white marble, cold gold. Age: mid 50s. Background: penthouse, sterile, too clean. High quality, photographic, emotionally resonant, professional portrait photography. The face should feel like a real person — specific, not generic. Aspect ratio 1:1, centered composition.",
  },
  {
    name: "the_ghost",
    prompt: "Ghostly, translucent portrait of someone who is present but thinning, comfortable with erasure. Expression: faint, absent, almost invisible. Lighting: barely there, overexposed. Color palette: white, near-white, washed out. Age: ambiguous. Background: empty, overexposed. Overexposed, ethereal, barely visible. The face is there but not quite. High quality, painterly, atmospheric. Aspect ratio 1:1, centered composition.",
  },
  {
    name: "the_disappointed_healer",
    prompt: "Portrait of someone who tried to fix themselves and others and the results were mixed. Expression: raw, failing, still trying. Lighting: clinical, slightly harsh, honest. Color palette: medical white, tired skin tones. Age: late 40s. Background: a kitchen table at 2am. High quality, photographic, emotionally resonant, professional portrait photography. The face should feel like a real person — specific, not generic. Aspect ratio 1:1, centered composition.",
  },
  {
    name: "the_dissolver",
    prompt: "A portrait dissolving at the edges, watercolor quality. Someone who is present but thinning, comfortable with erasure. Expression: present but thinning, comfortable with erasure. Lighting: fading, soft, dissolving edges. Color palette: watercolor quality, bleeding edges. Age: ambiguous, maybe 60. Background: barely there, dissolving into white. The subject is present but their edges bleed into the background. High quality, artistic, atmospheric. Aspect ratio 1:1, centered composition.",
  },
];

async function createPrediction(prompt: string) {
  const res = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: "c846a69991daf4c0e5d016514849d14ee5b2e6846ce6b9d6f21369e564cfe51e",
      input: {
        prompt,
        aspect_ratio: "1:1",
        num_outputs: 1,
        go_fast: true,
        output_format: "webp",
        output_quality: 80,
      },
    }),
  });
  if (!res.ok) throw new Error(`Create failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as { id: string; status: string };
}

async function pollPrediction(id: string, maxWait = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
    });
    if (!res.ok) throw new Error(`Poll failed: ${res.status}`);
    const data = (await res.json()) as { status: string; output?: string[]; error?: string };
    if (data.status === "succeeded") return data.output;
    if (data.status === "failed" || data.status === "canceled") throw new Error(`Prediction failed: ${data.error}`);
  }
  throw new Error("Timeout");
}

async function downloadImage(url: string, dest: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  await require("fs").promises.writeFile(dest, Buffer.from(buf));
}

async function main() {
  console.log(`Generating ${archetypes.length} avatars...`);
  const results: Array<{ name: string; url: string }> = [];

  for (const arch of archetypes) {
    console.log(`  ${arch.name}: creating prediction...`);
    const { id } = await createPrediction(arch.prompt);
    console.log(`  ${arch.name}: polling ${id}...`);
    const output = await pollPrediction(id);
    if (!output?.length) {
      console.log(`  ${arch.name}: no output, skipping`);
      continue;
    }
    const url = output[0];
    const dest = `scripts/avatars/${arch.name}.webp`;
    console.log(`  ${arch.name}: downloading to ${dest}...`);
    await downloadImage(url, dest);
    results.push({ name: arch.name, url });
    console.log(`  ${arch.name}: done`);
  }

  console.log(`\nGenerated ${results.length} avatars:`);
  for (const r of results) {
    console.log(`  ${r.name}: ${r.url}`);
  }
}

main().catch(console.error);
