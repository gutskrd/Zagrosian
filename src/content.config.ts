import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Legal pages, one directory per locale: src/content/legal/<locale>/<page>.md. English is the
 * source; the other locales are translations.
 */
const legal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/legal' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    /** Eyebrow above the title; defaults to the localized "Legal". */
    eyebrow: z.string().optional(),
    /** Last material change to the English source. */
    updated: z.coerce.date(),
  }),
});

export const collections = { legal };
