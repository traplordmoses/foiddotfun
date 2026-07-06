// Prediction-market news categories mapped to engaging, on-theme emoji sets.
// Modeled on the taxonomies used by Polymarket / Kalshi / Manifold.
//
// Shape: each category has a stable `id`, a display `label`, the `group` it
// belongs to, and an ordered `emojis` list (the first entry is the lead/primary
// emoji, suitable for compact chips or single-icon contexts).

export type PredictionCategoryGroup =
  | "politics"
  | "world"
  | "finance"
  | "crypto"
  | "tech"
  | "health"
  | "sports"
  | "entertainment"
  | "internet"
  | "lifestyle";

export interface PredictionCategory {
  /** Stable kebab-case identifier — safe to persist / key on. */
  id: string;
  /** User-facing display name. */
  label: string;
  /** Top-level domain this category rolls up into. */
  group: PredictionCategoryGroup;
  /** Ordered emoji set; emojis[0] is the lead/primary emoji. */
  emojis: string[];
}

export const PREDICTION_CATEGORY_GROUPS: Record<
  PredictionCategoryGroup,
  string
> = {
  politics: "Politics & Government",
  world: "World, Conflict & Justice",
  finance: "Economy & Finance",
  crypto: "Crypto",
  tech: "Tech & Science",
  health: "Climate & Health",
  sports: "Sports",
  entertainment: "Entertainment & Culture",
  internet: "Internet & Social",
  lifestyle: "Lifestyle & Other",
};

export const PREDICTION_CATEGORIES: readonly PredictionCategory[] = [
  // ── Politics & Government ──
  { id: "politics", label: "Politics", group: "politics", emojis: ["🗳️", "🏛️", "🎩", "📜", "⚖️", "🤝"] },
  { id: "elections", label: "Elections", group: "politics", emojis: ["🗳️", "🟦", "🟥", "📊", "🏆", "🎤"] },
  { id: "us-politics", label: "US Politics", group: "politics", emojis: ["🇺🇸", "🦅", "🏛️", "🐘", "🫏", "📋"] },
  { id: "trump", label: "Trump", group: "politics", emojis: ["🎩", "🇺🇸", "📣", "💼", "⚖️", "🔨"] },
  { id: "geopolitics", label: "Geopolitics / World", group: "politics", emojis: ["🌍", "🌐", "🚩", "🛂", "📡", "🤝"] },
  { id: "policy", label: "Legislation / Policy", group: "politics", emojis: ["📜", "✍️", "🏛️", "📋", "⚖️", "🗂️"] },

  // ── World, Conflict & Justice ──
  { id: "war", label: "War & Conflict", group: "world", emojis: ["⚔️", "💥", "🪖", "🛡️", "🚀", "🕊️"] },
  { id: "middle-east", label: "Middle East", group: "world", emojis: ["🕌", "🛢️", "🪖", "🕊️", "🗺️", "⚠️"] },
  { id: "crime-justice", label: "Crime & Justice", group: "world", emojis: ["⚖️", "🚔", "🔒", "🕵️", "🚨", "📜"] },
  { id: "disasters", label: "Disasters", group: "world", emojis: ["🌪️", "🔥", "🌊", "🚨", "🏚️", "⛑️"] },

  // ── Economy & Finance ──
  { id: "economy", label: "Economy / Macro", group: "finance", emojis: ["📈", "📉", "💵", "🏦", "🛒", "📊"] },
  { id: "rates", label: "Fed / Interest Rates", group: "finance", emojis: ["🏦", "📉", "💵", "🎯", "🪙", "📊"] },
  { id: "inflation", label: "Inflation / CPI", group: "finance", emojis: ["🛒", "📈", "💸", "🔥", "🧾", "📊"] },
  { id: "stocks", label: "Stocks & Markets", group: "finance", emojis: ["📈", "💹", "🐂", "🐻", "🔔", "💼"] },
  { id: "business", label: "Business & Companies", group: "finance", emojis: ["🏢", "💼", "🤝", "💰", "📊", "📈"] },
  { id: "earnings", label: "Earnings", group: "finance", emojis: ["📊", "💰", "📈", "🔔", "🧾", "💹"] },

  // ── Crypto ──
  { id: "crypto", label: "Crypto", group: "crypto", emojis: ["₿", "🪙", "🚀", "📉", "🐋", "💎"] },
  { id: "bitcoin", label: "Bitcoin", group: "crypto", emojis: ["₿", "🟠", "🚀", "💎", "🔐", "⛏️"] },
  { id: "ethereum", label: "Ethereum", group: "crypto", emojis: ["Ξ", "🦄", "🔷", "⛽", "🛠️", "🌐"] },
  { id: "memecoins", label: "Memecoins", group: "crypto", emojis: ["🐸", "🐕", "🚀", "📈", "💀", "🎰"] },
  { id: "nfts", label: "NFTs / Onchain Culture", group: "crypto", emojis: ["🖼️", "🐸", "⛓️", "🎨", "💎", "👾"] },

  // ── Tech & Science ──
  { id: "tech", label: "Tech", group: "tech", emojis: ["💻", "📱", "🔌", "⚙️", "🛜", "🚀"] },
  { id: "ai", label: "AI", group: "tech", emojis: ["🤖", "🧠", "⚡", "🦾", "✨", "📟"] },
  { id: "science", label: "Science", group: "tech", emojis: ["🔬", "🧪", "🧬", "⚛️", "📡", "🩻"] },
  { id: "space", label: "Space", group: "tech", emojis: ["🚀", "🛰️", "🌌", "🪐", "🌕", "👨‍🚀"] },

  // ── Climate & Health ──
  { id: "climate", label: "Climate & Weather", group: "health", emojis: ["🌡️", "🌪️", "🌊", "🔥", "❄️", "🌍"] },
  { id: "health", label: "Health & Medicine", group: "health", emojis: ["🩺", "💊", "🧬", "🦠", "🏥", "💉"] },
  { id: "pandemic", label: "Pandemic / Disease", group: "health", emojis: ["🦠", "😷", "💉", "🧪", "🏥", "📈"] },

  // ── Sports ──
  { id: "sports", label: "Sports", group: "sports", emojis: ["🏆", "🥇", "⚽", "🏀", "🏈", "⚾"] },
  { id: "soccer", label: "Soccer / Football", group: "sports", emojis: ["⚽", "🥅", "🏟️", "🟨", "🟥", "🏆"] },
  { id: "basketball", label: "Basketball / NBA", group: "sports", emojis: ["🏀", "🔥", "🏆", "📊", "👟", "🗑️"] },
  { id: "football", label: "American Football / NFL", group: "sports", emojis: ["🏈", "🏟️", "🎯", "🥇", "📣", "🧤"] },
  { id: "baseball", label: "Baseball / MLB", group: "sports", emojis: ["⚾", "🧢", "💎", "🦇", "🏟️", "🥎"] },
  { id: "combat", label: "Combat (MMA / Boxing)", group: "sports", emojis: ["🥊", "🥋", "🩸", "🔔", "🏆", "💪"] },
  { id: "racing", label: "Racing / F1", group: "sports", emojis: ["🏎️", "🏁", "🛞", "⛽", "🏆", "🚥"] },
  { id: "tennis", label: "Tennis", group: "sports", emojis: ["🎾", "🏆", "🟩", "🎯", "🤾"] },
  { id: "golf", label: "Golf", group: "sports", emojis: ["⛳", "🏌️", "🏆", "🟢", "🎯"] },
  { id: "olympics", label: "Olympics", group: "sports", emojis: ["🥇", "🔥", "🌍", "🏅", "🤸", "🎖️"] },
  { id: "esports", label: "Esports / Gaming", group: "sports", emojis: ["🎮", "🕹️", "👾", "🏆", "⚔️", "💀"] },

  // ── Entertainment & Culture ──
  { id: "pop-culture", label: "Pop Culture", group: "entertainment", emojis: ["🎬", "🍿", "⭐", "🎤", "📺", "💃"] },
  { id: "movies-tv", label: "Movies & TV", group: "entertainment", emojis: ["🎬", "🍿", "🎞️", "📺", "🎭", "🏆"] },
  { id: "music", label: "Music", group: "entertainment", emojis: ["🎵", "🎤", "🎸", "💿", "🔥", "🏆"] },
  { id: "awards", label: "Awards (Oscars / Grammys)", group: "entertainment", emojis: ["🏆", "🥇", "🎖️", "✨", "🎬", "🎶"] },
  { id: "celebrity", label: "Celebrity & Gossip", group: "entertainment", emojis: ["💋", "📸", "💔", "💍", "🕶️", "👑"] },
  { id: "royals", label: "Royals", group: "entertainment", emojis: ["👑", "💎", "🏰", "👸", "🇬🇧", "🫅"] },
  { id: "religion", label: "Religion", group: "entertainment", emojis: ["⛪", "🙏", "✝️", "☪️", "🕊️", "📿"] },

  // ── Internet & Social ──
  { id: "social-media", label: "Social Media", group: "internet", emojis: ["📱", "👍", "🔔", "💬", "🧵", "📸"] },
  { id: "influencers", label: "Influencers / Creators", group: "internet", emojis: ["🎥", "📸", "💸", "🔔", "👑", "🧢"] },
  { id: "memes", label: "Memes / Internet Culture", group: "internet", emojis: ["🐸", "😹", "🔥", "🚀", "📈", "💀"] },
  { id: "mentions", label: 'Mentions ("will X say Y")', group: "internet", emojis: ["💬", "🎤", "🗣️", "📢", "❓", "👀"] },

  // ── Lifestyle & Other ──
  { id: "transportation", label: "Transportation", group: "lifestyle", emojis: ["✈️", "🚗", "🚆", "🛳️", "🚦", "🚀"] },
  { id: "food", label: "Food & Dining", group: "lifestyle", emojis: ["🍔", "🍕", "🌮", "🍜", "🥡", "⭐"] },
  { id: "education", label: "Education", group: "lifestyle", emojis: ["🎓", "📚", "✏️", "🏫", "📝", "🧑‍🏫"] },
  { id: "travel", label: "Travel", group: "lifestyle", emojis: ["✈️", "🏖️", "🗺️", "🧳", "🏝️", "📍"] },
] as const;

// ── Helpers ──

/** Look up a single category by its stable id. */
export function getCategoryById(
  id: string,
): PredictionCategory | undefined {
  return PREDICTION_CATEGORIES.find((c) => c.id === id);
}

/** All categories within a given top-level group. */
export function getCategoriesByGroup(
  group: PredictionCategoryGroup,
): PredictionCategory[] {
  return PREDICTION_CATEGORIES.filter((c) => c.group === group);
}

/** The lead/primary emoji for a category id (falls back to "📊"). */
export function getPrimaryEmoji(id: string): string {
  return getCategoryById(id)?.emojis[0] ?? "📊";
}
