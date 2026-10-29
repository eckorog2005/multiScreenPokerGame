export function signed(net: number): string {
  if (net > 0) return `+${net}`;
  return net < 0 ? `−${-net}` : '0';
}
