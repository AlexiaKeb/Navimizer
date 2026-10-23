import { FunctionsHttpError } from '@supabase/supabase-js';
import { MAX_IMAGE_B64, MAX_TEXT_CHARS, localParse, looksClean } from '../../supabase/functions/_shared/extract.ts';
import { isBackendConfigured, supabase } from './supabase';

export type ImportErrorCode = 'pro_required' | 'not_configured' | 'quota' | 'refused' | 'busy' | 'too_big' | 'not_image' | 'failed';

const MESSAGES: Record<ImportErrorCode, string> = {
  pro_required: "L'import intelligent (texte en vrac, photo) est réservé au plan Pro.",
  not_configured: "L'analyse intelligente n'est pas activée sur ce site.",
  quota: "Limite quotidienne d'analyses atteinte : réessayez demain ou collez une liste d'adresses (une par ligne).",
  refused: "L'analyse a été refusée pour ce contenu. Saisissez les adresses manuellement.",
  busy: 'Le service est occupé, réessayez dans un instant.',
  too_big: 'Contenu trop volumineux : réduisez le texte ou la taille de la photo.',
  not_image: "Cette image n'a pas pu être lue. Essayez une photo JPEG ou PNG.",
  failed: "L'analyse a échoué. Réessayez ou saisissez les adresses manuellement.",
};

export class ImportError extends Error {
  constructor(public code: ImportErrorCode) {
    super(MESSAGES[code]);
  }
}

export interface ImportResult {
  addresses: string[];
  /** 'ai' : analysée par Claude ; 'local' : lecture simple du texte, sans IA. */
  source: 'ai' | 'local';
}

/** Redimensionne et recompresse la photo (≤ 1600 px, JPEG) : moins lourd, moins cher, plus rapide. */
export async function prepareImage(file: File): Promise<{ mediaType: string; data: string }> {
  if (!file.type.startsWith('image/')) throw new ImportError('not_image');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImportError('not_image');
  }
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const data = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
  if (data.length > MAX_IMAGE_B64) throw new ImportError('too_big');
  return { mediaType: 'image/jpeg', data };
}

async function callAi(body: { text?: string; image?: { mediaType: string; data: string } }): Promise<string[]> {
  if (!isBackendConfigured) throw new ImportError('not_configured');
  const { data, error } = await supabase.functions.invoke<{ addresses?: string[] }>('extract-addresses', { body });
  if (!error && data?.addresses) return data.addresses;
  if (error instanceof FunctionsHttpError) {
    const status = error.context.status;
    const payload = (await error.context.json().catch(() => null)) as { code?: ImportErrorCode } | null;
    if (status === 402) throw new ImportError('pro_required');
    if (status === 404 || status === 501) throw new ImportError('not_configured');
    if (status === 429) throw new ImportError(payload?.code === 'quota' ? 'quota' : 'busy');
    if (status === 413) throw new ImportError('too_big');
    if (status === 422) throw new ImportError('refused');
  }
  throw new ImportError('failed');
}

/**
 * Texte : si c'est déjà une liste propre, lecture locale (gratuit, instantané) ; sinon analyse par Claude (plan Pro),
 * avec repli sur la lecture locale si l'IA n'est pas disponible. Photo : analyse par Claude uniquement (plan Pro).
 */
export async function extractAddresses(input: { text?: string; image?: File; allowAi: boolean }): Promise<ImportResult> {
  const text = input.text?.trim() ?? '';
  if (text.length > MAX_TEXT_CHARS) throw new ImportError('too_big');

  if (!input.image) {
    if (!text) return { addresses: [], source: 'local' };
    if (looksClean(text)) return { addresses: localParse(text), source: 'local' };
    if (!input.allowAi) {
      // Plan gratuit : lecture simple du texte ; s'il ne contient rien d'exploitable, l'analyse intelligente est proposée
      const local = localParse(text);
      if (local.length > 0) return { addresses: local, source: 'local' };
      throw new ImportError('pro_required');
    }
    try {
      return { addresses: await callAi({ text }), source: 'ai' };
    } catch (e) {
      const local = localParse(text);
      if (local.length > 0 && e instanceof ImportError && e.code !== 'quota') return { addresses: local, source: 'local' };
      throw e;
    }
  }

  if (!input.allowAi) throw new ImportError('pro_required');
  const image = await prepareImage(input.image);
  return { addresses: await callAi({ text: text || undefined, image }), source: 'ai' };
}
