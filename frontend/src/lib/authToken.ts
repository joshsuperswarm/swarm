/**
 * Tiny reactive store (global module variable) that holds the Clerk
 * session JWT we need for backend API calls.
 */
let backendJwt: string | null = null;

export const setBackendJwt = (jwt: string | null) => (backendJwt = jwt);
export const getBackendJwt = () => backendJwt;