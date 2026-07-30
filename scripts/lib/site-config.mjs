export const SITE_CONFIG = Object.freeze({
  name: "Vedant Misra",
  siteUrl: "https://vedantmisra.dev",
  email: "thevedantmisra@gmail.com",
  title: "Product builder making AI useful",
  description:
    "Vedant Misra is an IIT Madras student and product builder working to make powerful AI useful in everyday life.",
  locale: "en_IN",
  language: "en-IN",
  twitterHandle: "@orcus108",
  profiles: Object.freeze({
    github: "https://github.com/orcus108",
    linkedin: "https://www.linkedin.com/in/misra-vedant/",
    substack: "https://vedantmisra.substack.com",
    x: "https://x.com/orcus108",
  }),
  indexNowKey: "8b7c40ea0288376097f3c036b4597bda",
});

export function resolveSiteUrl(env = process.env) {
  const raw =
    env.SITE_URL ||
    env.VERCEL_PROJECT_PRODUCTION_URL ||
    env.URL ||
    env.VERCEL_URL ||
    SITE_CONFIG.siteUrl;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, "");
}
