// import { unstable_noStore as noStore } from 'next/cache';

// noStore();

export type Env = typeof env;

export const env = {
    // SUPABASE_URL: process?.env?.SUPABASE_URL || "https://pheptqdoqsdnadgoihvr.supabase.co",
    SUPABASE_URL: "https://pheptqdoqsdnadgoihvr.supabase.co",
    // SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
};

// Validate all environment variables are set
Object.entries(env).forEach(([key, value]) => {
    if (!value) {
        throw new Error(`${key} is not set`);
    }
});