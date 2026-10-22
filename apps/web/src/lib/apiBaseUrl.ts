const LOCAL_API_BASE_URL = "http://localhost:3001/api";

export function getApiBaseUrl(configuredUrl = process.env.NEXT_PUBLIC_API_URL) {
  const value = configuredUrl?.trim() || LOCAL_API_BASE_URL;
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const normalized = withProtocol.replace(/\/+$/, "");

  return normalized.toLowerCase().endsWith("/api")
    ? normalized
    : `${normalized}/api`;
}
