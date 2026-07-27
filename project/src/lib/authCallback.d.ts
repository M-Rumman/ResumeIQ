export function handleSupabaseAuthCallback(): Promise<{ handled: boolean; error: string | null; emailVerified: boolean; passwordRecovery: boolean }>;
