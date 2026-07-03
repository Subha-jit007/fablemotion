/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remotion's server-side packages must not be bundled by webpack.
  serverExternalPackages: ["@remotion/bundler", "@remotion/renderer"],
  // These are read with fs at runtime — include them in serverless bundles.
  outputFileTracingIncludes: {
    "/api/agent": ["./agent/**", "./videos/**"],
    "/api/videos": ["./videos/**"],
    "/api/videos/[name]": ["./videos/**"],
  },
};

export default nextConfig;
