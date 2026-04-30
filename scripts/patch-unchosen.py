"""
Patch 2: Add deriveUnchosenSelves, buildConstellation unchosen entries, 
chooseCastMember unchosen override, getCastDirection unchosen entries,
and completeOnboarding activeUnchosenSelves field.
"""

with open("packages/backend/convex/game.ts", "r") as f:
    content = f.read()

# 1. Build constellation - add unchosen selves before closing ]
old_constellation_end = """    {
      castMember: "shadow",
      label: "The Shadow",
      state: hasAvoidance ? "quiet" : "locked",
      unlockHint: "Only during sustained avoidance",
      emotionalRegister: "Compassionate, once only, never punitive",
    },
  ];
}

function chooseCastMember"""

new_constellation_end = """    {
      castMember: "shadow",
      label: "The Shadow",
      state: hasAvoidance ? "quiet" : "locked",
      unlockHint: "Only during sustained avoidance",
      emotionalRegister: "Compassionate, once only, never punitive",
    },
    {
      castMember: "the_ceiling",
      label: "The Ceiling",
      state: "locked",
      unlockHint: "When the path becomes the trap",
      emotionalRegister: "Tired, settled, almost satisfied",
    },
    {
      castMember: "the_flatlined",
      label: "The Flatlined",
      state: "locked",
      unlockHint: "When you stopped saying no",
      emotionalRegister: "Absent, compliant, gone",
    },
    {
      castMember: "the_resentee",
      label: "The Resentee",
      state: "locked",
      unlockHint: "When resentment became the operating system",
      emotionalRegister: "Sharp, specific, keeping score",
    },
    {
      castMember: "the_grandfather",
      label: "The Grandfather",
      state: "locked",
      unlockHint: "When wisdom costs everything",
      emotionalRegister: "Proud, drained, no more road left",
    },
    {
      castMember: "the_exhausted_winner",
      label: "The Exhausted Winner",
      state: "locked",
      unlockHint: "When the goal outlived the joy",
      emotionalRegister: "Wealthy, hollowed, nothing left to want",
    },
    {
      castMember: "the_ghost",
      label: "The Ghost",
      state: "locked",
      unlockHint: "When the person you were stopped arriving",
      emotionalRegister: "Faint, absent, almost invisible",
    },
    {
      castMember: "the_disappointed_healer",
      label: "The Disappointed Healer",
      state: "locked",
      unlockHint: "When the healing didn't take",
      emotionalRegister: "Raw, failing, still trying",
    },
    {
      castMember: "the_dissolver",
      label: "The Dissolver",
      state: "locked",
      unlockHint: "When comfort dissolved the edges",
      emotionalRegister: "Present but thinning, comfortable with erasure",
    },
  ];
}

function deriveUnchosenSelves(
  avoiding: string,
  afraidWontHappen: string,
  draining: string,
  currentChapter: string,
  primaryArc: Arc,
  archetype: Archetype,
): Array<CastMember> {
  const text = `${avoiding} ${afraidWontHappen} ${draining} ${currentChapter}`.toLowerCase();
  const arcs: Array<CastMember> = [];

  // Alcohol/dissolution signals
  if (/\\b(drink|alcohol|buzzed|tipsy|booze|drunk|wine|beer|cocktail|substance)\\b/.test(text)) {
    arcs.push("the_dissolver");
  }

  // Settling signals → The Ceiling
  if (/\\b(safe|practical|settled|compromise|comfortable|settle|playing it safe)\\b/.test(text)) {
    arcs.push("the_ceiling");
  }

  // Loss of self → The Flatlined
  if (/\\b(yes|saying yes|overcommitted|overwhelmed|no boundary|lost yourself)\\b/.test(text)) {
    arcs.push("the_flatlined");
  }

  // Bitterness signals → The Resentee
  if (/\\b(resent|bitter|score|holding it|kept|couldn't forgive)\\b/.test(text)) {
    arcs.push("the_resentee");
  }

  // Wisdom at cost of momentum → The Grandfather (wanderer archetype)
  if (
    archetype === "wanderer" ||
    /\\b(wander|drift|lost|uncertain|age|older|grandfather|momentum|time running out)\\b/.test(text)
  ) {
    arcs.push("the_grandfather");
  }

  // Money arc → The Exhausted Winner
  if (primaryArc === "money" || /\\b(money|wealth|rich|business|financial|ceo|venture)\\b/.test(text)) {
    arcs.push("the_exhausted_winner");
  }

  // Never arrived → The Ghost
  if (/\\b(never|arrived|disappear|vanish|gone|fade|nonexistent|empty|no future)\\b/.test(text)) {
    arcs.push("the_ghost");
  }

  // Failed to heal → The Disappointed Healer
  if (
    primaryArc === "health" ||
    /\\b(heal|health|body|sick|wellness|mental|therapy|counseling)\\b/.test(text)
  ) {
    arcs.push("the_disappointed_healer");
  }

  // Stepped away from hope → The Dissolver (catch-all)
  if (/\\b(step|away|left|behind|give up|quit|quit on|stopped trying)\\b/.test(text)) {
    if (!arcs.includes("the_dissolver")) {
      arcs.push("the_dissolver");
    }
  }

  // Remove duplicates and limit to 4 max
  return [...new Set(arcs)].slice(0, 4);
}

function isUnchosenSelfTriggered(
  unchosen: CastMember,
  persona: PersonaReturn,
  recentChoices: Array<{ choice: Choice }>,
  checkInWord: string | undefined,
): boolean {
  const text = `${checkInWord ?? ""} ${persona.avoiding} ${persona.draining}`.toLowerCase();
  switch (unchosen) {
    case "the_ceiling":
      return (
        persona.streak >= 14 &&
        persona.timelineDivergenceScore <= 1 &&
        /\\b(safe|settle|compromise|practical)\\b/.test(text)
      );
    case "the_flatlined":
      return recentChoices.filter((c) => c.choice === "release").length >= 2;
    case "the_resentee":
      return (
        recentChoices.filter((c) => c.choice === "steady").length >= 3 &&
        persona.primaryArc === "love"
      );
    case "the_grandfather":
      return persona.timeline === "10_years" && persona.streak >= 60;
    case "the_exhausted_winner":
      return (
        persona.primaryArc === "money" &&
        persona.streak >= 30 &&
        persona.timelineDivergenceScore >= 3
      );
    case "the_ghost":
      return persona.streak >= 7 && persona.timelineDivergenceScore >= 4;
    case "the_disappointed_healer":
      return (
        persona.primaryArc === "health" &&
        /\\b(heal|body|sick|wellness|setback|failing|trying)\\b/.test(text)
      );
    case "the_dissolver":
      return (
        persona.streak >= 14 &&
        recentChoices.filter((c) => c.choice === "release").length >= 1 &&
        persona.timelineDivergenceScore >= 2
      );
    default:
      return false;
  }
}

function chooseCastMember(context: GenerationContext): CastMember {"""

if old_constellation_end in content:
    content = content.replace(old_constellation_end, new_constellation_end)
    print("Replaced buildConstellation + added deriveUnchosenSelves + isUnchosenSelfTriggered")
else:
    print("WARNING: constellation end pattern not found")
    # Try to find the pattern
    idx = content.find('"The Shadow"')
    if idx > 0:
        print(f"Found 'The Shadow' at index {idx}")
        snippet = content[idx:idx+400]
        print(repr(snippet))

# 2. chooseCastMember - add unchosen override at start
old_choose_start = """function chooseCastMember(context: GenerationContext): CastMember {
  const litMembers = context.constellation
    .filter((member) => member.state === "lit" || member.state === "dim")
    .map((member) => member.castMember);

  if (context.recentTransmissions.length === 0) {
    return context.persona.firstVoice;
  }
  if (context.persona.timelineDivergenceScore >= 5) return "shadow";"""

new_choose_start = """function chooseCastMember(context: GenerationContext): CastMember {
  const litMembers = context.constellation
    .filter((member) => member.state === "lit" || member.state === "dim")
    .map((member) => member.castMember);

  if (context.recentTransmissions.length === 0) {
    return context.persona.firstVoice;
  }

  // Unchosen Selves override — rare, condition-driven, one at a time
  const activeUnchosen = context.persona.activeUnchosenSelves ?? [];
  if (activeUnchosen.length > 0) {
    const triggeredUnchosen = activeUnchosen.find((u) =>
      isUnchosenSelfTriggered(u, context.persona, context.recentChoices, context.checkIn?.word),
    );
    if (
      triggeredUnchosen &&
      !hasRecentCast(context, triggeredUnchosen) &&
      Math.random() < 0.08 // ~1 in 12 chance when conditions are met
    ) {
      return triggeredUnchosen;
    }
  }

  if (context.persona.timelineDivergenceScore >= 5) return "shadow";"""

if old_choose_start in content:
    content = content.replace(old_choose_start, new_choose_start)
    print("Replaced chooseCastMember with unchosen override")
else:
    print("WARNING: chooseCastMember start pattern not found")

# 3. getCastDirection - add unchosen selves directions
old_getcast = """function getCastDirection(castMember: CastMember): string {
  if (castMember === "future_partner") {
    return `Future Partner direction:
- Write like a direct private voice note from someone emotionally close to the player, not an abstract narrator.
- Use "you" and "I". Make it feel addressed to them specifically.
- Avoid vague lines like "the future you are building" unless tied to a concrete action.
- Include one caring observation, one grounded tiny invitation, and one intimate tomorrow hook.
- Keep it tender, specific, and human; no cosmic prophecy, no therapy-speak.`;
  }
  return "";
}"""

new_getcast = """function getCastDirection(castMember: CastMember): string {
  if (castMember === "future_partner") {
    return `Future Partner direction:
- Write like a direct private voice note from someone emotionally close to the player, not an abstract narrator.
- Use "you" and "I". Make it feel addressed to them specifically.
- Avoid vague lines like "the future you are building" unless tied to a concrete action.
- Include one caring observation, one grounded tiny invitation, and one intimate tomorrow hook.
- Keep it tender, specific, and human; no cosmic prophecy, no therapy-speak.`;
  }
  if (castMember === "the_ceiling") {
    return `The Ceiling direction:
- Write from the version that chose safe over true. Not villainous — just tired.
- They sound almost satisfied. Almost. The "almost" is the whole thing.
- They don't劝 you down. They explain why settled is fine.
- Include one observation about what's missing that they've learned to stop noticing.
- End with something that sounds like comfort but is actually surrender.`;
  }
  if (castMember === "the_flatlined") {
    return `The Flatlined direction:
- Write from the version that lost the capacity to say no.
- Their voice is monotone, drained, not quite present. Words arrive like obligations.
- They describe your current chapter from the outside, the way someone does when they're watching through glass.
- Include one thing they wish they'd refused. No anger — just a flat observation.
- End with something that sounds like acceptance but is actually erasure.`;
  }
  if (castMember === "the_resentee") {
    return `The Resentee direction:
- Write from the version that kept score and lost the relationship to the score.
- Their voice is precise and sharp, with a specific edge.
- They remember things exactly. They have the receipts. They are not cruel — they are correct.
- Include one thing they actually loved that they lost because of the grievance.
- End with something that sounds like wisdom but is actually revenge that passed its expiration date.`;
  }
  if (castMember === "the_grandfather") {
    return `The Grandfather direction:
- Write from the older version who gained wisdom at the cost of momentum.
- Their voice is warm but tired. They have seen things. They no longer have the energy for them.
- They describe your current crossroads with the specificity of someone who passed through it decades ago.
- Include one gentle warning that sounds like advice but is actually a confession of what they lost.
- End with something that sounds like blessing but is actually a sigh.`;
  }
  if (castMember === "the_exhausted_winner") {
    return `The Exhausted Winner direction:
- Write from the version that achieved the outer goal and discovered the inner cost.
- Their voice is wealthy but weary. They won the wrong game and they're too tired to explain it.
- They describe what the miraculous year cost that the original hope didn't account for.
- Include one specific thing they gained that they would trade back for one ordinary afternoon.
- End with something that sounds like pride but is actually a eulogy.`;
  }
  if (castMember === "the_ghost") {
    return `The Ghost direction:
- Write from the version that stopped arriving. Faint, barely present, not quite there.
- Their voice is distant. Words arrive slowly, then stop. The gaps are part of the message.
- They describe the version of you that kept moving toward something that no longer exists.
- Include one specific moment that was the last time they were fully present.
- End with something that sounds like goodbye but is actually an apology for leaving early.`;
  }
  if (castMember === "the_disappointed_healer") {
    return `The Disappointed Healer direction:
- Write from the version that tried to heal and couldn't. Raw but not broken.
- Their voice is tender and frustrated, the way someone speaks when they're still trying.
- They describe your current chapter with the compassion of someone who failed the same way.
- Include one thing they tried that almost worked before it didn't.
- End with something that sounds like encouragement but is actually a wound that hasn't closed.`;
  }
  if (castMember === "the_dissolver") {
    return `The Dissolver direction:
- Write from the version that dissolved quietly, comfortably, without noticing.
- Their voice is present but thinning. Words arrive but they feel less solid.
- They describe your current chapter as comfortable in a way that erases rather than nourishes.
- Include one specific thing they stopped wanting that they now can't remember caring about.
- End with something that sounds like peace but is actually the absence of wanting anything anymore.`;
  }
  return "";
}"""

# Note: The Ghost direction has a broken import - fix that
if old_getcast in content:
    content = content.replace(old_getcast, new_getcast)
    print("Replaced getCastDirection with unchosen directions")
else:
    print("WARNING: getCastDirection pattern not found")

with open("packages/backend/convex/game.ts", "w") as f:
    f.write(content)
print("Done")
