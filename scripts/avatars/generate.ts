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
        output_quality: 90,
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
