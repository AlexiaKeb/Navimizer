// Fonction serveur Supabase : extrait des adresses d'un texte en vrac ou d'une photo avec Claude.
// Déploiement : supabase functions deploy extract-addresses
// Secrets : ANTHROPIC_API_KEY (obligatoire), ANTHROPIC_MODEL (défaut claude-opus-5-5 ; claude-haiku-5-5 pour réduire le coût),
//           AI_DAILY_LIMIT (analyses par utilisateur et par jour, défaut 30)
// Le JWT de l'utilisateur est vérifié par Supabase (verify_jwt) puis sert à décompter son quota.

import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  ADDRESS_SCHEMA,
  IMAGE_TYPES,
  MAX_IMAGE_B64,
  MAX_TEXT_CHARS,
  SYSTEM_PROMPT,
  parseModelText,
} from '../_shared/extract.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ code: 'invalid', message: 'Méthode non autorisée' }, 405);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ code: 'not_configured', message: "L'analyse intelligente n'est pas activée" }, 501);

  // --- Validation de l'entrée
  const body = await req.json().catch(() => null) as
    | { text?: unknown; image?: { mediaType?: unknown; data?: unknown } }
    | null;
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  const image = body?.image;
  const hasImage =
    !!image && typeof image.mediaType === 'string' && typeof image.data === 'string' && image.data.length > 0;
  if (!text && !hasImage) return json({ code: 'invalid', message: 'Aucun contenu à analyser' }, 400);
  if (text.length > MAX_TEXT_CHARS) return json({ code: 'too_big', message: 'Texte trop long' }, 413);
  if (hasImage) {
    if (!IMAGE_TYPES.includes(image!.mediaType as string)) return json({ code: 'invalid', message: "Format d'image non pris en charge" }, 400);
    if ((image!.data as string).length > MAX_IMAGE_B64) return json({ code: 'too_big', message: 'Image trop lourde' }, 413);
  }

  // --- Quota par utilisateur (échec = refus : on ne laisse jamais passer sans décompte)
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const limit = Number(Deno.env.get('AI_DAILY_LIMIT') ?? 30);
  const { data: allowed, error: quotaError } = await supabase.rpc('consume_ai_quota', { p_limit: limit });
  if (quotaError) {
    console.error(quotaError);
    return json({ code: 'upstream', message: 'Quota indisponible' }, 500);
  }
  if (!allowed) return json({ code: 'quota', message: `Limite de ${limit} analyses par jour atteinte` }, 429);

  // --- Appel à Claude
  const content: Record<string, unknown>[] = [];
  if (hasImage) content.push({ type: 'image', source: { type: 'base64', media_type: image!.mediaType, data: image!.data } });
  content.push({ type: 'text', text: text || 'Extrais les adresses visibles sur cette image.' });

  const client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 });
  // Opus 5.5 : pas de tool_choice forcé ni de température ; sortie structurée + effort bas pour une extraction simple.
  // deno-lint-ignore no-explicit-any
  const params: any = {
    model: Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-opus-5-5',
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: ADDRESS_SCHEMA } },
    messages: [{ role: 'user', content }],
  };

  try {
    // deno-lint-ignore no-explicit-any
    let response: any;
    try {
      // Repli automatique par le serveur si une protection décline la demande
      response = await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
    } catch (e) {
      if (!(e instanceof Anthropic.BadRequestError)) throw e;
      response = await client.messages.create(params); // compte sans accès à la bêta : appel standard
    }

    if (response.stop_reason === 'refusal') return json({ code: 'refused', message: 'Analyse refusée' }, 422);
    // deno-lint-ignore no-explicit-any
    const out = response.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
    return json({ addresses: parseModelText(out) });
  } catch (e) {
    console.error(e);
    if (e instanceof Anthropic.RateLimitError) return json({ code: 'busy', message: 'Service occupé, réessayez' }, 429);
    return json({ code: 'upstream', message: "L'analyse a échoué" }, 502);
  }
});
