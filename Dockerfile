FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
ENV OPENROUTER_API_KEY=dummy-build-key
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/next.config.js ./
COPY --from=build /app/postcss.config.js ./
COPY --from=build /app/tailwind.config.js ./
RUN mkdir -p data public/generated
EXPOSE 3001
CMD ["npx", "next", "start", "-p", "3001"]
