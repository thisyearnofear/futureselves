import sys
with open("packages/backend/convex/game.ts", "r") as f:
    content = f.read()

# Extend castMemberVoiceMap with unchosen selves
old_map = '''const castMemberVoiceMap: Record<CastMember, string> = {
  future_self: "21m00Tcm4TlvDq8ikWAM", // Ember-like: warm, intimate
  future_best_friend: "pFZP7JQGylIh6mjFyO2a", // Warm, conversational
  future_mentor: "TXhJ7dX3GJ5bNj6EPJpd", // Measured, slightly older
  future_partner: "MF3ZGxNSIZHw3HjBFBqu", // Vulnerable, emotionally charged
  future_employee: "a2HLqOq8XMFZ7V5kWzQf", // Grateful, professional
  future_customer: "wC6hHJG1mGSpDxHGNzX6", // Changed by something you built
  future_child: "bIHZnB3eyE6R7V5t7pJn", // Rare, gentle, devastating
  future_stranger: "kD5hB3fN4eR6H8jL2mQp", // Unknown, moving, uncanny
  alternate_self: "vN7rEPF2hR8G4sLb3jKc", // Familiar but slightly off
  shadow: "qW6tFDg1hO3nL9aY5pRs", // Gentle but unsettling
};'''

new_map = '''const castMemberVoiceMap: Record<CastMember, string> = {
  future_self: "21m00Tcm4TlvDq8ikWAM",
  future_best_friend: "pFZP7JQGylIh6mjFyO2a",
  future_mentor: "TXhJ7dX3GJ5bNj6EPJpd",
  future_partner: "MF3ZGxNSIZHw3HjBFBqu",
  future_employee: "a2HLqOq8XMFZ7V5kWzQf",
  future_customer: "wC6hHJG1mGSpDxHGNzX6",
  future_child: "bIHZnB3eyE6R7V5t7pJn",
  future_stranger: "kD5hB3fN4eR6H8jL2mQp",
  alternate_self: "vN7rEPF2hR8G4sLb3jKc",
  shadow: "qW6tFDg1hO3nL9aY5pRs",
  the_ceiling: "TxGEqnHWrfWFTfGW9XjX",
  the_flatlined: "uPMPQ7L8kO2nR5xH3jCd",
  the_resentee: "nL7mFK9pQ1wY4xT2vAbS",
  the_grandfather: "rQ3nBH6gO5sK7hY9xDfG",
  the_exhausted_winner: "jW5vCM2hK8mP3zX7nPqE",
  the_ghost: "gH8dLP4jN2qL6kW1vBsM",
  the_disappointed_healer: "fZ7nKR3kM1pH5jV8tQwL",
  the_dissolver: "eY6mJQ2iL9sF4qR3nBwD",
};'''

old_settings = '''const castMemberVoiceSettings: Record<CastMember, VoiceSettings> = {
  future_self: { stability: 0.72, similarityBoost: 0.85, style: 0.1, useSpeakerBoost: true },
  future_best_friend: { stability: 0.55, similarityBoost: 0.7, style: 0.38, useSpeakerBoost: false },
  future_mentor: { stability: 0.78, similarityBoost: 0.88, style: 0.12, useSpeakerBoost: true },
  future_partner: { stability: 0.48, similarityBoost: 0.72, style: 0.42, useSpeakerBoost: false },
  future_employee: { stability: 0.74, similarityBoost: 0.82, style: 0.15, useSpeakerBoost: true },
  future_customer: { stability: 0.7, similarityBoost: 0.8, style: 0.2, useSpeakerBoost: true },
  future_child: { stability: 0.44, similarityBoost: 0.75, style: 0.45, useSpeakerBoost: false },
  future_stranger: { stability: 0.65, similarityBoost: 0.72, style: 0.25, useSpeakerBoost: true },
  alternate_self: { stability: 0.62, similarityBoost: 0.78, style: 0.28, useSpeakerBoost: true },
  shadow: { stability: 0.68, similarityBoost: 0.65, style: 0.18, useSpeakerBoost: true },
};'''

new_settings = '''const castMemberVoiceSettings: Record<CastMember, VoiceSettings> = {
  future_self: { stability: 0.72, similarityBoost: 0.85, style: 0.1, useSpeakerBoost: true },
  future_best_friend: { stability: 0.55, similarityBoost: 0.7, style: 0.38, useSpeakerBoost: false },
  future_mentor: { stability: 0.78, similarityBoost: 0.88, style: 0.12, useSpeakerBoost: true },
  future_partner: { stability: 0.48, similarityBoost: 0.72, style: 0.42, useSpeakerBoost: false },
  future_employee: { stability: 0.74, similarityBoost: 0.82, style: 0.15, useSpeakerBoost: true },
  future_customer: { stability: 0.7, similarityBoost: 0.8, style: 0.2, useSpeakerBoost: true },
  future_child: { stability: 0.44, similarityBoost: 0.75, style: 0.45, useSpeakerBoost: false },
  future_stranger: { stability: 0.65, similarityBoost: 0.72, style: 0.25, useSpeakerBoost: true },
  alternate_self: { stability: 0.62, similarityBoost: 0.78, style: 0.28, useSpeakerBoost: true },
  shadow: { stability: 0.68, similarityBoost: 0.65, style: 0.18, useSpeakerBoost: true },
  the_ceiling: { stability: 0.8, similarityBoost: 0.9, style: 0.05, useSpeakerBoost: true },
  the_flatlined: { stability: 0.88, similarityBoost: 0.95, style: 0.02, useSpeakerBoost: false },
  the_resentee: { stability: 0.52, similarityBoost: 0.75, style: 0.32, useSpeakerBoost: true },
  the_grandfather: { stability: 0.82, similarityBoost: 0.85, style: 0.08, useSpeakerBoost: true },
  the_exhausted_winner: { stability: 0.76, similarityBoost: 0.88, style: 0.1, useSpeakerBoost: true },
  the_ghost: { stability: 0.9, similarityBoost: 0.6, style: 0.15, useSpeakerBoost: false },
  the_disappointed_healer: { stability: 0.45, similarityBoost: 0.7, style: 0.48, useSpeakerBoost: false },
  the_dissolver: { stability: 0.6, similarityBoost: 0.68, style: 0.22, useSpeakerBoost: false },
};

type UnchosenSelfBase = "the_ceiling" | "the_flatlined" | "the_resentee" | "the_grandfather" | "the_exhausted_winner" | "the_ghost" | "the_disappointed_healer" | "the_dissolver";'''

if old_map in content:
    content = content.replace(old_map, new_map)
    print("Replaced castMemberVoiceMap")
else:
    print("WARNING: castMemberVoiceMap pattern not found")

if old_settings in content:
    content = content.replace(old_settings, new_settings)
    print("Replaced castMemberVoiceSettings")
else:
    print("WARNING: castMemberVoiceSettings pattern not found")

with open("packages/backend/convex/game.ts", "w") as f:
    f.write(content)
print("Done")
