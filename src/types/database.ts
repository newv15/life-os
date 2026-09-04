/**
 * PLACEHOLDER - replaced by generated types once the Supabase project exists:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 *
 * Kept permissive on purpose so the rest of the codebase can be written and
 * type-checked before the database is provisioned. Do not hand-edit once the
 * generated version lands.
 */
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = any
