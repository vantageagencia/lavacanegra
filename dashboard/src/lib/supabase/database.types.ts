// Placeholder — será substituído pelos tipos gerados via `supabase gen types typescript`.
// Mantemos permissivo enquanto a migration não roda; depois geramos os tipos exatos.
/* eslint-disable @typescript-eslint/no-explicit-any */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = any;
