import { writeFileSync } from "fs";

async function run() {
  const apiKey = "sk_94278313ee6990de6d9d612f486c18b377e5de281195bc5e";
  const voiceId = "cjVigY5qzO86Huf0OWal"; // Future Mentor
  const text = "I know the exact room you're sitting in right now. I know what you're circling, and what you're afraid to name. You don't need a bigger sign. You just need one honest word. I'm waiting for it.";

  console.log("Synthesizing audio...");
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "accept": "audio/mpeg",
      "xi-api-key": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.78,
        similarity_boost: 0.88,
        style: 0.12,
        use_speaker_boost: true
      }
    })
  });

  if (!res.ok) {
    console.error("Failed:", await res.text());
    process.exit(1);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  writeFileSync("apps/default/assets/audio/sample-transmission.mp3", buffer);
  console.log("Saved to apps/default/assets/audio/sample-transmission.mp3");
}

run().catch(console.error);
