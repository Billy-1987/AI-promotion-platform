FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
# Remove any cached build artifacts so Next.js always does a full fresh compile
RUN rm -rf .next
ENV OPENROUTER_API_KEY=dummy-build-key
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
RUN mkdir -p public/generated data

# Patch standalone server to extend HTTP timeout for long-running AI routes
RUN sed -i 's/server\.listen(/server.keepAliveTimeout=180000;server.headersTimeout=185000;server.listen(/' server.js

EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
