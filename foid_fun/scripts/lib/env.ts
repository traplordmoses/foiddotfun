export function requireEnv<T>(label: string, value: T | undefined | null): T {
  if (value == null || value === "") {
    throw new Error(
      `Missing ${label}. If you're using .env.local, run with DOTENV_CONFIG_PATH=.env.local.`
    );
  }
  return value as T;
}

export function resolveFirst(
  env: NodeJS.ProcessEnv,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = env[key];
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

export function resolveRpcUrl(env: NodeJS.ProcessEnv): string | undefined {
  return resolveFirst(env, [
    "NEXT_PUBLIC_FLUENT_RPC",
    "FLUENT_RPC_URL",
    "NEXT_PUBLIC_RPC_URL",
    "RPC_URL",
  ]);
}

export function normalizePk(pk: string): `0x${string}` {
  return (pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`;
}
