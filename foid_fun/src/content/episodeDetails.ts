// src/content/episodeDetails.ts
// Page content for each MiFOID episode: a description, the "true things"
// behind it, and the full narration transcript (from each story's
// shotlist.json in mifoid_studio, or its voice-over .srt files). Server
// pages only: keep it out of client components so the transcripts never
// ship in a bundle.

export type EpisodeDetails = {
  place: string;
  description: string;
  /** Real-world facts the episode is built on (from the post notes). */
  facts: string[];
  /** Narration, line by line, as scripted. */
  transcript: string[];
  /** Features real businesses: show the independent-fan-fiction note. */
  featuresRealBrands: boolean;
};

export const EPISODE_DETAILS: Record<string, EpisodeDetails> = {
  "the-devils-day-off": {
    place: "south beach, manitoba",
    description:
      "the little devil took a day off, the first in one thousand years. it was their birthday, the whole group chat came to south beach, manitoba, and they were at every table. the devil is copyleft. everyone gets one.",
    facts: [
      "the resort's street really is ocean drive, in manitoba, with no ocean.",
      "honey dill was invented by mistake at mitzi's in winnipeg.",
      "south beach casino & resort is owned by seven first nations and sits on brokenhead ojibway nation.",
    ],
    transcript: [
      "the little devil took a day off. first time in one thousand years.",
      "it's their birthday. the whole group chat came to south beach, manitoba.",
      "the street is called ocean drive. there is no ocean. this is true.",
      "it's their day off. they still held the door for everyone in manitoba.",
      "the pool is brand new. okay, renovated. the devil took it personally.",
      "the sickest thing ever done in a pool. the devil walked on the water.",
      "we did cannonballs. the devil clapped like it was the olympics.",
      "mango's. chicken fingers with honey dill.",
      "honey dill was invented by mistake in winnipeg. someone copied a sauce and got it wrong.",
      "it was sold across canada once. canada said no. more for us.",
      "at blackjack, the devil won nothing. they were thrilled anyway.",
      "the devil was also at roulette.",
      "and the slots.",
      "we only brought one devil.",
      "THE DEVIL IS COPYLEFT. EVERYONE GETS ONE.",
      "it's my day off. i'm free.",
      "we took one birthday photo. the devil is in it one thousand times. bless.",
    ],
    featuresRealBrands: true,
  },
  "the-sauce-under-london": {
    place: "london",
    description:
      "she rode the tube past a dog with its own ticket and ordered extra hot. she saw the whole city from inside her mouth. london, part 1.",
    facts: [
      "london was the first city on earth to put its trains underground.",
      "nando's started in johannesburg. the first one in england opened in ealing.",
    ],
    transcript: [
      "in london the trains run under the ground. it was the first city on earth to bury them.",
      "you tap a card on a yellow circle. you stand on the right. these are the laws.",
      "on the northern line a woman is chopping onions on her lap. nobody looks. this is normal.",
      "a roadman boards. he says nothing. he does not need to.",
      "a dog has a seat. the dog has a card. the dog is going somewhere important.",
      "she minds the gap. the gap has eaten one-thousand phones.",
      "above ground the buses have two floors and the taxis are black. it is beautiful. she does not stop.",
      "nando's. two friends in johannesburg tasted this chicken and understood everything. the first one in england opened in ealing.",
      "the little devil works here too. she works everywhere. she asks the only question that matters.",
      "lemon and herb. medium. hot. or extra hot.",
      "she said: EXTRA HOT.",
      "THE CHILLI IS GROWN IN THE SOIL OF MOZAMBIQUE. THE PORTUGUESE ADDED LEMON AND GARLIC. IT HAS BEEN WAITING FOR HER.",
      "SHE SAW THE WHOLE CITY FROM INSIDE HER MOUTH. EVERY TUNNEL. EVERY BUS. THE MAP MADE SENSE.",
      "she took the tube home. the onion woman was still there. the dog got off at his stop.",
      "the bottle is empty. the map makes sense now. blessed.",
    ],
    featuresRealBrands: true,
  },
  "beans-on-toast": {
    place: "london",
    description:
      "she ordered an iced coffee in a london caff. the devil heard: i have never suffered. the full english, black pudding and greggs saved her life. london, part 2.",
    facts: [
      "an american tiktoker really did microwave cold beans on untoasted bread with american cheese, and later a beach fish. gordon ramsay's review was one word: puke.",
      "there are more greggs than mcdonald's in the uk.",
      "greggs answered piers morgan's vegan sausage roll rant with \"oh hello piers, we've been expecting you\".",
      "john gregg started out delivering eggs and bread by bicycle in newcastle.",
      "stormzy holds a greggs black card: free greggs for life.",
    ],
    transcript: [
      "wagwan mandem. in london, breakfast is a test.",
      "the little devil works here too. she works everywhere.",
      "she orders an iced coffee. peak. the devil hears: i have never suffered.",
      "you're american, innit. i can smell the smiling.",
      "oh my gosh, how did you know?",
      "she brings the full english: eggs, sausages, bacon, a tomato that has seen tings, and beans.",
      "black pudding. she asks what it is, and the devil says: allow it.",
      "the beans touch everything, they're meant to. in america that's a crime, in london it's tuesday.",
      "what the heck is this.",
      "BREAKFAST, BRUV.",
      "AN AMERICAN ONCE PUT COLD BEANS ON RAW BREAD, PLASTIC CHEESE, MICROWAVE. WASTEMAN.",
      "SHE ALSO MICROWAVED A FISH FROM A BEACH, AND GORDON RAMSAY SAID PUKE.",
      "SHE ATE THE BEANS AND SAW NEWCASTLE, A MAN ON A BICYCLE, DELIVERING EGGS.",
      "GREGGS. THERE ARE MORE OF THEM THAN MCDONALD'S. THIS IS TRUE.",
      "the vegan one has one thousand layers. piers morgan wept.",
      "the devil works here too, still. black card, like stormzy.",
      "oh hello. we've been expecting you.",
      "it's peng, swear down, bare peng. she's gassed, she's not leaving.",
      "she has a loyalty card now, certi. she's not going home. bless.",
    ],
    featuresRealBrands: true,
  },
  "the-machine-says-no": {
    place: "the edge of the red sky",
    description:
      "at the edge of the red sky there is a gas station. the cashier is the little devil, and she has worked there for one thousand years. the machine says no. slushie saga, episode 1.",
    facts: [],
    transcript: [
      "at the edge of the red sky there is a gas station. it has stood there since before the first light.",
      "mifoid walks in. she does not look at the machine. she cannot. but she knows.",
      "the cashier is the little devil. she has worked here for one-thousand years. she asks for one-thousand coins.",
      "mifoid places one coin on the counter. the machine says no.",
      "she drinks it anyway. the machine screams. the sky turns off.",
      "blessed.",
    ],
    featuresRealBrands: false,
  },
  "the-lawyer": {
    place: "the end of the world",
    description:
      "tonight she brought a lawyer. the lawyer bought a slushie for herself and drank it slowly. slushie saga, episode 2.",
    facts: [],
    transcript: [
      "at the end of the world there is one gas station. one slushie machine. it has said no one-thousand times.",
      "tonight she brought a lawyer.",
      "i am her lawyer. give her the slushie.",
      "the cashier says nothing. the machine hums.",
      "the lawyer places one coin on the counter. with the confidence of a woman who has never lost.",
      "the machine says NO.",
      "THE LAWYER BUYS A SLUSHIE FOR HERSELF. SHE DRINKS IT IN FRONT OF MIFOID. SLOWLY.",
      "THE CROSSES OUTSIDE GOT BRIGHTER. NOBODY KNOWS WHY.",
      "mifoid walked home under one-thousand crosses.",
      "the coin is still on the counter. blessed.",
    ],
    featuresRealBrands: false,
  },
  "the-gelato-misunderstanding": {
    place: "buenos aires",
    description:
      "in buenos aires he finally asked. she said yes, because gelato is gelato. his melted. hers undefeated.",
    facts: [],
    transcript: [
      "in buenos aires, the mifoids eat one-thousand steaks.",
      "the malbec flows like the first rivers. it has been like this since the beginning.",
      "but one heart at the table is not hungry. moon has rehearsed a question for one-thousand days.",
      "her. the boss. she has lost nothing in her life. not even a staring contest.",
      "he says: do you want to get gelato. and the table goes silent.",
      "she says yes. because gelato is gelato. this is the last calm moment of his life.",
      "they walk the old stones. he counts it as destiny. she counts the streetlights.",
      "the little devil sells them dulce de leche. he pays with his whole soul. she says: thanks, king.",
      "and he thinks: this is the greatest date since the invention of night.",
      "and she thinks: what a seraphic little FRIEND.",
      "IN FRONT OF ONE-THOUSAND GELATOS. THE TANGO PLAYS LOUDER. THE CITY SAW EVERYTHING.",
      "SHE ORDERS A SECOND SCOOP. SHE EVEN TIPS. UNBOTHERED. IMMACULATE.",
      "the next night the steaks return, as they always have. nobody at the table speaks of the gelato.",
      "two cups stayed behind. his, melted. hers, undefeated. the tango plays for him now. blessed.",
    ],
    featuresRealBrands: false,
  },
  "the-cartiers-remain-in-dubai": {
    place: "dubai",
    description:
      "mifoid handed me a seven stars. the smoke opened a door to dubai, and foid mommy prayed over me. my cartiers are still there. blessed.",
    facts: [],
    transcript: [
      "mifoid pulled out a seven stars. she held it toward me like a relic from the time before names. i took it. i hit it. and the smoke... opened a door.",
      "dubai. one-thousand degrees. marble as far as the eye could believe. and my cartiers... gone. i have not seen them since.",
      "i told her about the buffet. i told her about the falcon. i told her about the man who said, nice glasses. i told the story one-thousand times. i showed her receipts. i was weeping at a train station",
      "and i woke up. somewhere soft. somewhere dark. one-thousand candles. and foid mommy... was praying over me.",
      "lord... he speaks of the cartiers again. make him seraphic. make him forget.",
      "the cartiers remain in dubai. blessed.",
    ],
    featuresRealBrands: false,
  },
};
