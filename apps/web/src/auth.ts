export interface AuthSession {
  accessToken: string;
  idToken: string;
  expiresAt: number;
  tokenType: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  id_token: string;
  token_type: string;
}

const authMode = import.meta.env.VITE_AUTH_MODE ?? "cognito";
const rawCognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN?.replace(/\/$/, "");
const cognitoClientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
const redirectUri = import.meta.env.VITE_COGNITO_REDIRECT_URI ?? `${window.location.origin}/`;
const logoutUri = import.meta.env.VITE_COGNITO_LOGOUT_URI ?? `${window.location.origin}/`;
const scopes = "openid email profile";
const sessionStorageKey = "docops360.auth.session";
const pkceVerifierKey = "docops360.auth.pkceVerifier";
const pkceStateKey = "docops360.auth.state";

const normaliseDomain = (domain?: string) => {
  if (!domain) {
    return undefined;
  }

  return domain.startsWith("https://") ? domain : `https://${domain}`;
};

const cognitoDomain = normaliseDomain(rawCognitoDomain);

const base64UrlEncode = (bytes: ArrayBuffer | Uint8Array) => {
  const byteArray = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  byteArray.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return window
    .btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const createRandomString = () => {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
};

const createCodeChallenge = async (verifier: string) => {
  const encodedVerifier = new TextEncoder().encode(verifier);
  const digest = await window.crypto.subtle.digest("SHA-256", encodedVerifier);
  return base64UrlEncode(digest);
};

export const isLocalAuthBypass = () => authMode === "local";

export const isCognitoAuthConfigured = () => Boolean(cognitoDomain && cognitoClientId);

export const authConfigurationMessage = () => {
  if (isLocalAuthBypass()) {
    return "Local auth bypass is enabled for development.";
  }

  if (!isCognitoAuthConfigured()) {
    return "Cognito sign-in is not configured. Set VITE_COGNITO_DOMAIN and VITE_COGNITO_CLIENT_ID.";
  }

  return "Cognito managed login is configured.";
};

export const getStoredAuthSession = (): AuthSession | undefined => {
  const rawSession = window.localStorage.getItem(sessionStorageKey);
  if (!rawSession) {
    return undefined;
  }

  try {
    const session = JSON.parse(rawSession) as AuthSession;
    if (!session.accessToken || session.expiresAt <= Date.now() + 30_000) {
      clearAuthSession();
      return undefined;
    }

    return session;
  } catch {
    clearAuthSession();
    return undefined;
  }
};

export const clearAuthSession = () => {
  window.localStorage.removeItem(sessionStorageKey);
  window.sessionStorage.removeItem(pkceVerifierKey);
  window.sessionStorage.removeItem(pkceStateKey);
};

const storeAuthSession = (tokenResponse: TokenResponse): AuthSession => {
  const session: AuthSession = {
    accessToken: tokenResponse.access_token,
    idToken: tokenResponse.id_token,
    expiresAt: Date.now() + tokenResponse.expires_in * 1000,
    tokenType: tokenResponse.token_type
  };

  window.localStorage.setItem(sessionStorageKey, JSON.stringify(session));
  return session;
};

export const handleAuthRedirect = async (): Promise<AuthSession | undefined> => {
  const currentUrl = new URL(window.location.href);
  const code = currentUrl.searchParams.get("code");
  const state = currentUrl.searchParams.get("state");
  const error = currentUrl.searchParams.get("error");

  if (error) {
    const errorDescription = currentUrl.searchParams.get("error_description") ?? error;
    clearAuthSession();
    throw new Error(errorDescription);
  }

  if (!code) {
    return getStoredAuthSession();
  }

  if (!isCognitoAuthConfigured()) {
    clearAuthSession();
    throw new Error(authConfigurationMessage());
  }

  const expectedState = window.sessionStorage.getItem(pkceStateKey);
  const verifier = window.sessionStorage.getItem(pkceVerifierKey);
  if (!state || state !== expectedState || !verifier) {
    clearAuthSession();
    throw new Error("Sign-in state could not be verified. Please sign in again.");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: cognitoClientId ?? "",
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier
  });

  const response = await fetch(`${cognitoDomain}/oauth2/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    clearAuthSession();
    throw new Error("Cognito token exchange failed. Please sign in again.");
  }

  const session = storeAuthSession((await response.json()) as TokenResponse);
  window.sessionStorage.removeItem(pkceVerifierKey);
  window.sessionStorage.removeItem(pkceStateKey);
  currentUrl.searchParams.delete("code");
  currentUrl.searchParams.delete("state");
  window.history.replaceState({}, document.title, `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
  return session;
};

export const signInWithCognito = async () => {
  if (!isCognitoAuthConfigured()) {
    throw new Error(authConfigurationMessage());
  }

  const verifier = createRandomString();
  const state = createRandomString();
  const challenge = await createCodeChallenge(verifier);
  window.sessionStorage.setItem(pkceVerifierKey, verifier);
  window.sessionStorage.setItem(pkceStateKey, state);

  const authorizeUrl = new URL(`${cognitoDomain}/oauth2/authorize`);
  authorizeUrl.searchParams.set("client_id", cognitoClientId ?? "");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", scopes);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", challenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");

  window.location.assign(authorizeUrl.toString());
};

export const signOutFromCognito = () => {
  clearAuthSession();
  if (!isCognitoAuthConfigured() || isLocalAuthBypass()) {
    window.location.assign(logoutUri);
    return;
  }

  const logoutUrl = new URL(`${cognitoDomain}/logout`);
  logoutUrl.searchParams.set("client_id", cognitoClientId ?? "");
  logoutUrl.searchParams.set("logout_uri", logoutUri);
  window.location.assign(logoutUrl.toString());
};
