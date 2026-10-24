declare const __LAN_HOST__: string | undefined;

const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

// A phone can't reach the dev machine's `localhost`, so in development the QR link uses its LAN address instead.
export function joinUrl(code: string): string {
  const lanHost = typeof __LAN_HOST__ === 'string' ? __LAN_HOST__ : undefined;
  const origin =
    lanHost && loopbackHosts.has(location.hostname)
      ? `${location.protocol}//${lanHost}${location.port ? `:${location.port}` : ''}`
      : location.origin;
  return `${origin}/play?code=${encodeURIComponent(code)}`;
}
