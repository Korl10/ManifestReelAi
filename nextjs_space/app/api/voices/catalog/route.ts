export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import {
  VOICE_CATALOG, VOICE_CATEGORIES, VOICE_ACCENTS, VOICE_USE_CASES,
  CATEGORY_DESCRIPTIONS, CATEGORY_TEST_PHRASES,
  filterVoices,
} from '@/lib/voice-catalog';

/**
 * GET /api/voices/catalog?gender=&accent=&category=&useCase=&ageRange=&search=
 * Returns the full voice catalog (or filtered subset) with rich metadata.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const gender = url.searchParams.get('gender') || undefined;
  const accent = url.searchParams.get('accent') || undefined;
  const category = url.searchParams.get('category') || undefined;
  const useCase = url.searchParams.get('useCase') || undefined;
  const ageRange = url.searchParams.get('ageRange') || undefined;
  const search = url.searchParams.get('search') || undefined;

  const voices = filterVoices({ gender, accent, category, useCase, ageRange, search });

  return NextResponse.json({
    voices: voices.map(v => ({
      id: v.id,
      name: v.name,
      gender: v.gender,
      ageRange: v.ageRange,
      accent: v.accent,
      language: v.language,
      category: v.category,
      useCases: v.useCases,
      description: v.description,
      defaultTier: v.defaultTier,
      supportedTiers: v.supportedTiers,
      multilingual: v.multilingual,
      previewUrl: v.previewUrl,
      samplePath: v.samplePath,
    })),
    filters: {
      categories: VOICE_CATEGORIES,
      accents: VOICE_ACCENTS,
      useCases: VOICE_USE_CASES,
      genders: ['female', 'male'],
      ageRanges: ['young', 'middle', 'senior'],
    },
    categoryDescriptions: CATEGORY_DESCRIPTIONS,
    testPhrases: CATEGORY_TEST_PHRASES,
    total: voices.length,
  });
}
