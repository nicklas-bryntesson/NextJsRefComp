import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* The app lives in web/ inside a repo whose root also holds the
     reference-components submodule. Without this, Turbopack walks up past the
     repo looking for a lockfile and picks up an unrelated one from $HOME. */
  turbopack: { root: __dirname },
};

export default nextConfig;
