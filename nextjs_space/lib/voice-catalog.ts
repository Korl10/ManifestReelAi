/**
 * ManifestReel AI — Premium Voice Catalog
 *
 * Rich metadata for every voice: ElevenLabs voice ID, language, accent,
 * gender, age range, use case tags, and model tier.
 *
 * Voice tiers:
 *   - flash      → eleven_flash_v2_5  (fast, cheapest)
 *   - multilingual → eleven_multilingual_v2 (best quality, default)
 *   - turbo      → eleven_turbo_v2_5  (low latency, good quality)
 *
 * Cinematic tier auto-selects "multilingual" (the best).
 */

export type VoiceTier = 'flash' | 'multilingual' | 'turbo';

export interface VoiceEntry {
  id: string;                   // internal ID e.g. "female-aria"
  name: string;                 // display name
  elevenLabsId: string;         // ElevenLabs voice_id
  gender: 'female' | 'male';
  ageRange: 'young' | 'middle' | 'senior';
  accent: string;               // e.g. "American", "British", "Australian"
  language: string;             // primary language
  category: string;             // UI grouping: Female, Male, Mysterious, etc.
  useCases: string[];           // tags: narration, meditation, motivation, etc.
  description: string;          // short desc
  defaultTier: VoiceTier;       // recommended tier
  supportedTiers: VoiceTier[];  // all supported tiers
  samplePath: string;           // /voices/library/<id>.mp3
}

// ── ElevenLabs voice IDs ──
// These map to real ElevenLabs voices. The IDs below are from the
// ElevenLabs voice library.
const EL = {
  rachel:      '21m00Tcm4TlvDq8ikWAM',
  adam:        'pNInz6obpgDQGcFmaJgB',
  bella:       'EXAVITQu4vr4xnSDxMaL',
  domi:        'AZnzlk1XvdvUeBnXmlld',
  elli:        'MF3mGyEYCl7XYWbV9V6O',
  josh:        'TxGEqnHWrfWFTfGW9XjX',
  arnold:      'VR6AewLTigWG4xSOukaG',
  sam:         'yoZ06aMxZJJ28mfd3POQ',
  nicole:      'piTKgcLEGmPE4e6mEKli',
  glinda:      'z9fAnlkpzviPz146aGWa',
  clyde:       '2EiwWnXFnvU5JabPnv8n',
  emily:       'LcfcDJNUP1GQjkzn1xUU',
  charlotte:   'XB0fDUnXU5powFXDhCwa',
  matilda:     'XrExE9yKIg1WjnnlVkGX',
  dorothy:     'ThT5KcBeYPX3keUQqHPh',
  fin:         'D38z5RcWu1voky8WS1ja',
  callum:      'N2lVS1w4EtoT3dr4eOWO',
  charlie:     'IKne3meq5aSn9XLyUdCD',
  george:      'JBFqnCBsd6RMkjVDRZzb',
  freya:       'jsCqWAovK2LkecY7zXl4',
  lily:        'pFZP5JQG7iQjIQuC4Bku',
  james:       'ZQe5CZNOzWyzPSCn5a3c',
};

export const VOICE_CATALOG: VoiceEntry[] = [
  // ── Female voices ──────────────────────────────────────
  { id: 'female-aria', name: 'Aria', elevenLabsId: EL.rachel, gender: 'female', ageRange: 'middle', accent: 'American', language: 'English', category: 'Female', useCases: ['narration', 'manifestation', 'storytelling'], description: 'Warm & confident', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/female-aria.mp3' },
  { id: 'female-jenny', name: 'Jenny', elevenLabsId: EL.nicole, gender: 'female', ageRange: 'young', accent: 'American', language: 'English', category: 'Female', useCases: ['narration', 'uplifting', 'friendly'], description: 'Friendly & clear', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/female-jenny.mp3' },
  { id: 'female-emma', name: 'Emma', elevenLabsId: EL.elli, gender: 'female', ageRange: 'young', accent: 'American', language: 'English', category: 'Female', useCases: ['narration', 'uplifting', 'cheerful'], description: 'Bright & cheerful', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/female-emma.mp3' },
  { id: 'female-michelle', name: 'Michelle', elevenLabsId: EL.bella, gender: 'female', ageRange: 'middle', accent: 'American', language: 'English', category: 'Female', useCases: ['meditation', 'narration', 'soft'], description: 'Soft & gentle', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/female-michelle.mp3' },
  { id: 'female-ava', name: 'Ava', elevenLabsId: EL.charlotte, gender: 'female', ageRange: 'middle', accent: 'American', language: 'English', category: 'Female', useCases: ['narration', 'storytelling', 'expressive'], description: 'Smooth & expressive', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/female-ava.mp3' },
  { id: 'female-sonia', name: 'Sonia', elevenLabsId: EL.dorothy, gender: 'female', ageRange: 'middle', accent: 'British', language: 'English', category: 'Female', useCases: ['narration', 'elegant', 'refined'], description: 'British elegance', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/female-sonia.mp3' },
  { id: 'female-libby', name: 'Libby', elevenLabsId: EL.freya, gender: 'female', ageRange: 'young', accent: 'British', language: 'English', category: 'Female', useCases: ['narration', 'refined', 'educational'], description: 'British & refined', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/female-libby.mp3' },
  { id: 'female-maisie', name: 'Maisie', elevenLabsId: EL.lily, gender: 'female', ageRange: 'young', accent: 'British', language: 'English', category: 'Female', useCases: ['narration', 'youthful', 'sweet'], description: 'Youthful & sweet', defaultTier: 'flash', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/female-maisie.mp3' },
  { id: 'female-natasha', name: 'Natasha', elevenLabsId: EL.matilda, gender: 'female', ageRange: 'middle', accent: 'Australian', language: 'English', category: 'Female', useCases: ['narration', 'warm', 'storytelling'], description: 'Aussie warmth', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/female-natasha.mp3' },
  { id: 'female-clara', name: 'Clara', elevenLabsId: EL.glinda, gender: 'female', ageRange: 'middle', accent: 'Canadian', language: 'English', category: 'Female', useCases: ['narration', 'clarity', 'professional'], description: 'Canadian clarity', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/female-clara.mp3' },
  { id: 'female-emily', name: 'Emily', elevenLabsId: EL.emily, gender: 'female', ageRange: 'young', accent: 'Irish', language: 'English', category: 'Female', useCases: ['narration', 'charming', 'storytelling'], description: 'Irish charm', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/female-emily.mp3' },
  { id: 'female-leah', name: 'Leah', elevenLabsId: EL.domi, gender: 'female', ageRange: 'middle', accent: 'American', language: 'English', category: 'Female', useCases: ['narration', 'calm', 'grounded'], description: 'Calm & grounded', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/female-leah.mp3' },
  { id: 'female-ana', name: 'Ana', elevenLabsId: EL.lily, gender: 'female', ageRange: 'young', accent: 'American', language: 'English', category: 'Female', useCases: ['narration', 'youthful', 'light'], description: 'Light & youthful', defaultTier: 'flash', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/female-ana.mp3' },
  { id: 'female-aria-soft', name: 'Aria Soft', elevenLabsId: EL.rachel, gender: 'female', ageRange: 'middle', accent: 'American', language: 'English', category: 'Female', useCases: ['meditation', 'soothing', 'asmr'], description: 'Soothing & mellow', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/female-aria-soft.mp3' },
  { id: 'female-sonia-bright', name: 'Sonia Bright', elevenLabsId: EL.dorothy, gender: 'female', ageRange: 'middle', accent: 'British', language: 'English', category: 'Female', useCases: ['narration', 'upbeat', 'energetic'], description: 'Crisp & upbeat', defaultTier: 'turbo', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/female-sonia-bright.mp3' },

  // ── Male voices ─────────────────────────────────────────
  { id: 'male-guy', name: 'Guy', elevenLabsId: EL.adam, gender: 'male', ageRange: 'middle', accent: 'American', language: 'English', category: 'Male', useCases: ['narration', 'confident', 'deep'], description: 'Deep & confident', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/male-guy.mp3' },
  { id: 'male-andrew', name: 'Andrew', elevenLabsId: EL.josh, gender: 'male', ageRange: 'middle', accent: 'American', language: 'English', category: 'Male', useCases: ['narration', 'warm', 'sincere'], description: 'Warm & sincere', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/male-andrew.mp3' },
  { id: 'male-brian', name: 'Brian', elevenLabsId: EL.clyde, gender: 'male', ageRange: 'middle', accent: 'American', language: 'English', category: 'Male', useCases: ['narration', 'casual', 'calm'], description: 'Casual & calm', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/male-brian.mp3' },
  { id: 'male-christopher', name: 'Christopher', elevenLabsId: EL.arnold, gender: 'male', ageRange: 'senior', accent: 'American', language: 'English', category: 'Male', useCases: ['narration', 'authority', 'powerful'], description: 'Authority & power', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/male-christopher.mp3' },
  { id: 'male-eric', name: 'Eric', elevenLabsId: EL.sam, gender: 'male', ageRange: 'middle', accent: 'American', language: 'English', category: 'Male', useCases: ['narration', 'smooth', 'steady'], description: 'Smooth & steady', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/male-eric.mp3' },
  { id: 'male-roger', name: 'Roger', elevenLabsId: EL.george, gender: 'male', ageRange: 'senior', accent: 'British', language: 'English', category: 'Male', useCases: ['narration', 'resonant', 'documentary'], description: 'Rich & resonant', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/male-roger.mp3' },
  { id: 'male-steffan', name: 'Steffan', elevenLabsId: EL.fin, gender: 'male', ageRange: 'middle', accent: 'British', language: 'English', category: 'Male', useCases: ['narration', 'crisp', 'professional'], description: 'Crisp narrator', defaultTier: 'turbo', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/male-steffan.mp3' },
  { id: 'male-ryan', name: 'Ryan', elevenLabsId: EL.callum, gender: 'male', ageRange: 'young', accent: 'British', language: 'English', category: 'Male', useCases: ['narration', 'charming', 'british'], description: 'British charm', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/male-ryan.mp3' },
  { id: 'male-thomas', name: 'Thomas', elevenLabsId: EL.charlie, gender: 'male', ageRange: 'senior', accent: 'British', language: 'English', category: 'Male', useCases: ['narration', 'gravitas', 'documentary'], description: 'British gravitas', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/male-thomas.mp3' },
  { id: 'male-william', name: 'William', elevenLabsId: EL.james, gender: 'male', ageRange: 'middle', accent: 'Australian', language: 'English', category: 'Male', useCases: ['narration', 'deep', 'warm'], description: 'Aussie depth', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/male-william.mp3' },
  { id: 'male-liam', name: 'Liam', elevenLabsId: EL.callum, gender: 'male', ageRange: 'young', accent: 'Canadian', language: 'English', category: 'Male', useCases: ['narration', 'relaxed', 'friendly'], description: 'Canadian ease', defaultTier: 'flash', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/male-liam.mp3' },
  { id: 'male-connor', name: 'Connor', elevenLabsId: EL.fin, gender: 'male', ageRange: 'young', accent: 'Irish', language: 'English', category: 'Male', useCases: ['narration', 'warm', 'storytelling'], description: 'Irish warmth', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/male-connor.mp3' },
  { id: 'male-luke', name: 'Luke', elevenLabsId: EL.josh, gender: 'male', ageRange: 'middle', accent: 'American', language: 'English', category: 'Male', useCases: ['narration', 'grounded', 'smooth'], description: 'Smooth & grounded', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/male-luke.mp3' },
  { id: 'male-guy-deep', name: 'Guy Deep', elevenLabsId: EL.adam, gender: 'male', ageRange: 'middle', accent: 'American', language: 'English', category: 'Male', useCases: ['narration', 'deep', 'bold'], description: 'Extra deep & bold', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/male-guy-deep.mp3' },
  { id: 'male-roger-warm', name: 'Roger Warm', elevenLabsId: EL.george, gender: 'male', ageRange: 'senior', accent: 'British', language: 'English', category: 'Male', useCases: ['narration', 'warm', 'reassuring'], description: 'Warm & reassuring', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/male-roger-warm.mp3' },

  // ── Category voices (Mysterious, Historical, Biblical, Motivational, Educated, Meditation) ──
  { id: 'mys-aria', name: 'Aria', elevenLabsId: EL.rachel, gender: 'female', ageRange: 'middle', accent: 'American', language: 'English', category: 'Mysterious', useCases: ['mysterious', 'storytelling', 'enigmatic'], description: 'Hushed & enigmatic', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/mys-aria.mp3' },
  { id: 'mys-brian', name: 'Brian', elevenLabsId: EL.clyde, gender: 'male', ageRange: 'middle', accent: 'American', language: 'English', category: 'Mysterious', useCases: ['mysterious', 'dark', 'secretive'], description: 'Dark & secretive', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/mys-brian.mp3' },
  { id: 'mys-sonia', name: 'Sonia', elevenLabsId: EL.dorothy, gender: 'female', ageRange: 'middle', accent: 'British', language: 'English', category: 'Mysterious', useCases: ['mysterious', 'whisper', 'velvet'], description: 'Velvet whisper', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/mys-sonia.mp3' },
  { id: 'mys-thomas', name: 'Thomas', elevenLabsId: EL.charlie, gender: 'male', ageRange: 'senior', accent: 'British', language: 'English', category: 'Mysterious', useCases: ['mysterious', 'brooding', 'deep'], description: 'Brooding & deep', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/mys-thomas.mp3' },
  { id: 'mys-natasha', name: 'Natasha', elevenLabsId: EL.matilda, gender: 'female', ageRange: 'middle', accent: 'Australian', language: 'English', category: 'Mysterious', useCases: ['mysterious', 'sultry', 'intriguing'], description: 'Sultry & intriguing', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/mys-natasha.mp3' },

  { id: 'his-thomas', name: 'Thomas', elevenLabsId: EL.charlie, gender: 'male', ageRange: 'senior', accent: 'British', language: 'English', category: 'Historical', useCases: ['documentary', 'historical', 'narration'], description: 'Stately narrator', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/his-thomas.mp3' },
  { id: 'his-ryan', name: 'Ryan', elevenLabsId: EL.callum, gender: 'male', ageRange: 'young', accent: 'British', language: 'English', category: 'Historical', useCases: ['documentary', 'measured', 'classic'], description: 'Measured & classic', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/his-ryan.mp3' },
  { id: 'his-libby', name: 'Libby', elevenLabsId: EL.freya, gender: 'female', ageRange: 'young', accent: 'British', language: 'English', category: 'Historical', useCases: ['documentary', 'refined', 'chronicler'], description: 'Refined chronicler', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/his-libby.mp3' },
  { id: 'his-roger', name: 'Roger', elevenLabsId: EL.george, gender: 'male', ageRange: 'senior', accent: 'British', language: 'English', category: 'Historical', useCases: ['documentary', 'gravitas', 'narration'], description: 'Documentary gravitas', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/his-roger.mp3' },

  { id: 'bib-guy', name: 'Guy', elevenLabsId: EL.adam, gender: 'male', ageRange: 'middle', accent: 'American', language: 'English', category: 'Biblical', useCases: ['scripture', 'reverent', 'deep'], description: 'Reverent & deep', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/bib-guy.mp3' },
  { id: 'bib-christopher', name: 'Christopher', elevenLabsId: EL.arnold, gender: 'male', ageRange: 'senior', accent: 'American', language: 'English', category: 'Biblical', useCases: ['scripture', 'prophetic', 'powerful'], description: 'Prophetic power', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/bib-christopher.mp3' },
  { id: 'bib-andrew', name: 'Andrew', elevenLabsId: EL.josh, gender: 'male', ageRange: 'middle', accent: 'American', language: 'English', category: 'Biblical', useCases: ['scripture', 'solemn', 'sacred'], description: 'Solemn & sacred', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/bib-andrew.mp3' },
  { id: 'bib-william', name: 'William', elevenLabsId: EL.james, gender: 'male', ageRange: 'middle', accent: 'Australian', language: 'English', category: 'Biblical', useCases: ['scripture', 'narration', 'steady'], description: 'Scripture narrator', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/bib-william.mp3' },

  { id: 'mot-guy', name: 'Guy', elevenLabsId: EL.adam, gender: 'male', ageRange: 'middle', accent: 'American', language: 'English', category: 'Motivational', useCases: ['motivation', 'bold', 'driven'], description: 'Bold & driven', defaultTier: 'turbo', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/mot-guy.mp3' },
  { id: 'mot-aria', name: 'Aria', elevenLabsId: EL.rachel, gender: 'female', ageRange: 'middle', accent: 'American', language: 'English', category: 'Motivational', useCases: ['motivation', 'energetic', 'fierce'], description: 'Energetic & fierce', defaultTier: 'turbo', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/mot-aria.mp3' },
  { id: 'mot-andrew', name: 'Andrew', elevenLabsId: EL.josh, gender: 'male', ageRange: 'middle', accent: 'American', language: 'English', category: 'Motivational', useCases: ['motivation', 'hype', 'powerful'], description: 'Hype & powerful', defaultTier: 'turbo', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/mot-andrew.mp3' },
  { id: 'mot-brian', name: 'Brian', elevenLabsId: EL.clyde, gender: 'male', ageRange: 'middle', accent: 'American', language: 'English', category: 'Motivational', useCases: ['motivation', 'coach', 'cheerleader'], description: 'Coach & cheerleader', defaultTier: 'turbo', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/mot-brian.mp3' },
  { id: 'mot-emma', name: 'Emma', elevenLabsId: EL.elli, gender: 'female', ageRange: 'young', accent: 'American', language: 'English', category: 'Motivational', useCases: ['motivation', 'uplifting', 'bright'], description: 'Uplifting & bright', defaultTier: 'turbo', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/mot-emma.mp3' },

  { id: 'edu-michelle', name: 'Michelle', elevenLabsId: EL.bella, gender: 'female', ageRange: 'middle', accent: 'American', language: 'English', category: 'Educated', useCases: ['educational', 'articulate', 'clear'], description: 'Articulate & clear', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/edu-michelle.mp3' },
  { id: 'edu-eric', name: 'Eric', elevenLabsId: EL.sam, gender: 'male', ageRange: 'middle', accent: 'American', language: 'English', category: 'Educated', useCases: ['educational', 'professor', 'calm'], description: 'Professor calm', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/edu-eric.mp3' },
  { id: 'edu-libby', name: 'Libby', elevenLabsId: EL.freya, gender: 'female', ageRange: 'young', accent: 'British', language: 'English', category: 'Educated', useCases: ['educational', 'polished', 'lecturer'], description: 'Polished lecturer', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/edu-libby.mp3' },
  { id: 'edu-thomas', name: 'Thomas', elevenLabsId: EL.charlie, gender: 'male', ageRange: 'senior', accent: 'British', language: 'English', category: 'Educated', useCases: ['educational', 'scholarly', 'precise'], description: 'Scholarly & precise', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/edu-thomas.mp3' },

  { id: 'med-ava', name: 'Ava', elevenLabsId: EL.charlotte, gender: 'female', ageRange: 'middle', accent: 'American', language: 'English', category: 'Meditation', useCases: ['meditation', 'soft', 'whisper', 'asmr'], description: 'Soft female whisper', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/med-ava.mp3' },
  { id: 'med-eric', name: 'Eric', elevenLabsId: EL.sam, gender: 'male', ageRange: 'middle', accent: 'American', language: 'English', category: 'Meditation', useCases: ['meditation', 'calm', 'guide'], description: 'Calm male guide', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/med-eric.mp3' },
  { id: 'med-libby', name: 'Libby', elevenLabsId: EL.freya, gender: 'female', ageRange: 'young', accent: 'British', language: 'English', category: 'Meditation', useCases: ['meditation', 'gentle', 'tranquil'], description: 'Gentle & tranquil', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/med-libby.mp3' },
  { id: 'med-sonia', name: 'Sonia', elevenLabsId: EL.dorothy, gender: 'female', ageRange: 'middle', accent: 'British', language: 'English', category: 'Meditation', useCases: ['meditation', 'serene', 'slow'], description: 'Serene & slow', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/med-sonia.mp3' },
  { id: 'med-emily', name: 'Emily', elevenLabsId: EL.emily, gender: 'female', ageRange: 'young', accent: 'Irish', language: 'English', category: 'Meditation', useCases: ['meditation', 'dreamy', 'peaceful'], description: 'Dreamy & peaceful', defaultTier: 'multilingual', supportedTiers: ['flash', 'multilingual', 'turbo'], samplePath: '/voices/library/med-emily.mp3' },
];

/** All unique categories in the catalog. */
export const VOICE_CATEGORIES = [...new Set(VOICE_CATALOG.map(v => v.category))];

/** All unique accents. */
export const VOICE_ACCENTS = [...new Set(VOICE_CATALOG.map(v => v.accent))];

/** All unique use cases. */
export const VOICE_USE_CASES = [...new Set(VOICE_CATALOG.flatMap(v => v.useCases))];

/** Lookup a voice by internal ID. */
export function getVoiceById(id: string): VoiceEntry | undefined {
  return VOICE_CATALOG.find(v => v.id === id);
}

/** ElevenLabs model_id for a given tier. */
export function modelIdForTier(tier: VoiceTier): string {
  switch (tier) {
    case 'flash': return 'eleven_flash_v2_5';
    case 'turbo': return 'eleven_turbo_v2_5';
    case 'multilingual':
    default: return 'eleven_multilingual_v2';
  }
}

/** Resolve the best tier for a given voice + user-requested tier. */
export function resolveTier(voice: VoiceEntry, requestedTier?: VoiceTier): VoiceTier {
  if (requestedTier && voice.supportedTiers.includes(requestedTier)) return requestedTier;
  return voice.defaultTier;
}

/** Filter the catalog. All filters are AND. */
export function filterVoices(opts: {
  gender?: string;
  accent?: string;
  category?: string;
  useCase?: string;
  ageRange?: string;
  search?: string;
}): VoiceEntry[] {
  let result = VOICE_CATALOG;
  if (opts.gender) result = result.filter(v => v.gender === opts.gender);
  if (opts.accent) result = result.filter(v => v.accent === opts.accent);
  if (opts.category) result = result.filter(v => v.category === opts.category);
  if (opts.useCase) result = result.filter(v => v.useCases.includes(opts.useCase!));
  if (opts.ageRange) result = result.filter(v => v.ageRange === opts.ageRange);
  if (opts.search) {
    const q = opts.search.toLowerCase();
    result = result.filter(v =>
      v.name.toLowerCase().includes(q) ||
      v.description.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q) ||
      v.accent.toLowerCase().includes(q) ||
      v.useCases.some(u => u.includes(q))
    );
  }
  return result;
}
