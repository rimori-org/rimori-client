declare global {
    interface Window {
        APP_CONFIG: {
            SUPABASE_URL: string;
            SUPABASE_ANON_KEY: string;
        }
    }
}

export const getEnv = (): Window['APP_CONFIG'] => {
    const env = {
        SUPABASE_URL: window.APP_CONFIG.SUPABASE_URL,
        SUPABASE_ANON_KEY: window.APP_CONFIG.SUPABASE_ANON_KEY,
    }
    Object.entries(env).forEach(([key, value]) => {
        if (!value) {
            throw new Error(`${key} is not set`);
        }
    });
    return env;
}
