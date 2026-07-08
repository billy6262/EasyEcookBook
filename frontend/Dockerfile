FROM node:20-alpine AS development

WORKDIR /app
COPY package*.json ./
# npm install (not ci) because package-lock.json is generated on first run.
# After first run: copy the lock file out, commit it, then switch back to npm ci.
RUN npm install
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]
