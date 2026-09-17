/**
 * The app's display name.
 *
 * Single source of truth: the sidebar wordmark, the mobile header fallback, the
 * login branding panel, the login footer and the document <title> all read it
 * from here. A rename is one edit instead of six, and the six copies can never
 * drift apart. As a JS string it also sidesteps JSX entity escaping.
 */
export const APP_NAME = "Tuco & Nito";
