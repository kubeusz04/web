export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/g/", "/editor/", "/dashboard", "/admin"],
    },
  };
}
