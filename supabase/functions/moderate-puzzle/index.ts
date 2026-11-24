// Supabase Edge Function: Automated NSFW & Safety Moderation for UGC Puzzles
// Deploy with: supabase functions deploy moderate-puzzle
//
// Optional Secrets (set in Supabase Dashboard -> Edge Functions -> Secrets):
//   OPENAI_API_KEY              -> Uses OpenAI omni-moderation-latest (image + text)
//   SIGHTENGINE_USER            -> Alternative vision moderation provider
//   SIGHTENGINE_SECRET
//   MODERATION_DEV_AUTO_APPROVE -> Set "true" for early dev without external API keys

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BLOCKED_TERMS = [
  'nsfw',
  'nude',
  'naked',
  'porn',
  'xxx',
  'hentai',
  'gore',
  'explicit',
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ModerationVerdict {
  status: 'approved' | 'rejected' | 'pending';
  reason: string | null;
}

function checkTitleSafety(title: string): string | null {
  const normalized = title.toLowerCase();
  for (const term of BLOCKED_TERMS) {
    if (normalized.includes(term)) {
      return `Title contains prohibited term ("${term}")`;
    }
  }
  return null;
}

async function moderateWithOpenAI(
  title: string,
  imageUrl: string,
  apiKey: string
): Promise<ModerationVerdict> {
  const response = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'omni-moderation-latest',
      input: [
        { type: 'text', text: title },
        { type: 'image_url', image_url: { url: imageUrl } },
      ],
    }),
  });

  if (!response.ok) {
    return { status: 'pending', reason: 'Moderation provider unavailable; queued for review' };
  }

  const data = await response.json();
  const result = data.results?.[0];
  if (result?.flagged) {
    const flaggedCategories = Object.entries(result.categories ?? {})
      .filter(([, flagged]) => Boolean(flagged))
      .map(([name]) => name)
      .join(', ');
    return {
      status: 'rejected',
      reason: `Blocked by safety filter (${flaggedCategories || 'policy violation'})`,
    };
  }

  return { status: 'approved', reason: null };
}

async function moderateWithSightengine(
  imageUrl: string,
  apiUser: string,
  apiSecret: string
): Promise<ModerationVerdict> {
  const params = new URLSearchParams({
    url: imageUrl,
    models: 'nudity-2.1,wad,offensive',
    api_user: apiUser,
    api_secret: apiSecret,
  });

  const response = await fetch(
    `https://api.sightengine.com/1.0/check.json?${params.toString()}`
  );

  if (!response.ok) {
    return { status: 'pending', reason: 'Moderation provider unavailable; queued for review' };
  }

  const data = await response.json();
  const nudity = data.nudity ?? {};
  const unsafeNudity =
    (nudity.sexual_activity ?? 0) > 0.35 ||
    (nudity.sexual_display ?? 0) > 0.35 ||
    (nudity.erotica ?? 0) > 0.45;
  const unsafeWeaponDrugs =
    (data.weapon ?? 0) > 0.6 || (data.drugs ?? 0) > 0.6;
  const unsafeOffensive = (data.offensive?.prob ?? 0) > 0.6;

  if (unsafeNudity || unsafeWeaponDrugs || unsafeOffensive) {
    return {
      status: 'rejected',
      reason: 'Image failed automated NSFW / safety policy scan',
    };
  }

  return { status: 'approved', reason: null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';

    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { puzzleId } = await req.json();
    if (!puzzleId) {
      return new Response(JSON.stringify({ error: 'puzzleId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: puzzle, error: fetchError } = await adminClient
      .from('puzzles')
      .select('*')
      .eq('id', puzzleId)
      .eq('author_id', user.id)
      .single();

    if (fetchError || !puzzle) {
      return new Response(JSON.stringify({ error: 'Puzzle not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Fast title text safety check
    let verdict: ModerationVerdict;
    const titleIssue = checkTitleSafety(puzzle.title);
    if (titleIssue) {
      verdict = { status: 'rejected', reason: titleIssue };
    } else {
      // 2. External Vision API moderation (OpenAI or Sightengine)
      const openAiKey = Deno.env.get('OPENAI_API_KEY');
      const seUser = Deno.env.get('SIGHTENGINE_USER');
      const seSecret = Deno.env.get('SIGHTENGINE_SECRET');
      const devAutoApprove = Deno.env.get('MODERATION_DEV_AUTO_APPROVE') === 'true';

      if (openAiKey) {
        verdict = await moderateWithOpenAI(puzzle.title, puzzle.image_url, openAiKey);
      } else if (seUser && seSecret) {
        verdict = await moderateWithSightengine(puzzle.image_url, seUser, seSecret);
      } else if (devAutoApprove) {
        verdict = { status: 'approved', reason: null };
      } else {
        verdict = {
          status: 'pending',
          reason: 'Queued for moderator review (configure OPENAI_API_KEY or SIGHTENGINE secrets for instant approval)',
        };
      }
    }

    await adminClient
      .from('puzzles')
      .update({
        moderation_status: verdict.status,
        moderation_reason: verdict.reason,
      })
      .eq('id', puzzleId);

    // If rejected, immediately delete the offending image from Storage
    if (verdict.status === 'rejected' && puzzle.storage_path) {
      await adminClient.storage.from('puzzle-images').remove([puzzle.storage_path]);
    }

    return new Response(JSON.stringify({ puzzleId, ...verdict }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Moderation error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
