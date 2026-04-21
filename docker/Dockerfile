# ---- Stage 1: Build ----
# Usa una imagen de Node.js como base
FROM node:24 AS builder

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /usr/src/app

# Copia los archivos de definición de dependencias
COPY package*.json ./

# Instala todas las dependencias
RUN npm install

# Copia el resto del código de la aplicación
COPY . .

# Asegura que el cliente de Prisma se genere durante la compilación
RUN npx prisma generate

# Ejecuta el script de compilación de NestJS
RUN npm run build

# ---- Stage 2: Production ----
# Usa una imagen más ligera para la producción
FROM node:24-alpine

# Argumento para el usuario de la aplicación
ARG NODE_ENV=dev
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

# --- CORRECCIÓN CLAVE ---
# Copia todo el contenido del proyecto desde la etapa de construcción.
# Esto incluye 'dist', 'node_modules', 'prisma', 'keys', y cualquier otro archivo/carpeta.
COPY --from=builder /usr/src/app .

# (Recomendado) Ejecuta 'prisma generate' de nuevo para asegurar que el cliente
# es compatible con el sistema operativo de producción (Alpine Linux).
RUN npx prisma generate

# Expone el puerto en el que correrá la aplicación
EXPOSE 3000

# El comando para iniciar la aplicación
CMD ["node", "dist/main"]
