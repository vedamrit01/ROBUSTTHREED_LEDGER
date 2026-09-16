// Portable builds explicitly use the server that serves the interface.
// An unconfigured GitHub Pages build must still show the setup notice.
export function apiConnection(production: boolean, configuredUrl: string, sameOrigin: boolean) {
  const apiOrigin = sameOrigin ? "" : configuredUrl.trim().replace(/\/$/, "");
  return { apiOrigin, needsApiConfiguration: production && !apiOrigin && !sameOrigin };
}
