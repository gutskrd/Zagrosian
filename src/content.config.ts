import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Legal pages, one folder per language: src/content/legal/<language>/<page>.md.
 * English is the original; the other languages are translations of it.
 */
const legal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/legal' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    /** Small label above the title; defaults to "Legal" in the page's language. */
    eyebrow: z.string().optional(),
    /** Date of the last material change of the English original. */
    updated: z.coerce.date(),
  }),
});

export const collections = { legal };
