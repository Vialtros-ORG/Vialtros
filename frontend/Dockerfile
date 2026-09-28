# Etapa 1: construir la aplicacion React
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build


# Etapa 2: servir los archivos estaticos
FROM node:20-alpine AS serve

WORKDIR /app

RUN npm install --global serve

COPY --from=build /app/build ./build

EXPOSE 3000

CMD ["serve", "-s", "build", "-l", "3000"]