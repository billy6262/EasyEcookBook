FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS development

WORKDIR /app
COPY package*.json ./
# npm install (not ci) because package-lock.json is generated on first run.
# After first run: copy the lock file out, commit it, then switch back to npm ci.
RUN npm ci
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]
