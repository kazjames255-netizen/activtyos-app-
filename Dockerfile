# The ActivityOS API (server/). The Next.js web app deploys separately on
# Vercel and ignores this file.
#
# Why a Dockerfile at all: Railway's builders auto-detect the Next.js app at
# the repo root and build THAT — the wrong half of the repo — and the builder
# in use changed underneath us (nixpacks.toml is read by Nixpacks, ignored by
# Railpack). A Dockerfile is honoured by both and pins the behaviour.
#
# The build context is the REPO ROOT on purpose: the API imports pure shared
# modules from ../../../features and ../../../lib, so the whole tree must be
# present. Only the server's dependencies are installed.
FROM node:22-slim

WORKDIR /app

# Dependencies first, so a code-only change reuses this layer.
COPY server/package.json server/package-lock.json ./server/
# `tsx` is a runtime dependency of the server (not a devDependency) precisely
# because this runs with NODE_ENV=production, which skips devDependencies.
RUN npm --prefix server ci

COPY . .

ENV NODE_ENV=production
# Railway injects PORT; server/src/index.ts reads it and falls back to 4000.
EXPOSE 4000

# tsx runs the TypeScript directly — there is no build step.
CMD ["npm", "--prefix", "server", "start"]
