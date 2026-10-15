// The engine may use crypto.getRandomValues and nothing else from the platform, so it gets neither the DOM nor Node types.
declare var crypto: {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
};
