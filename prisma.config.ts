import "dotenv/config";
import { defineConfig } from "prisma/config";

// 1. Extraer las variables del entorno (cargadas por dotenv)
const user = process.env.DATABASE_USER;
const password = process.env.DATABASE_PASSWORD ?? ""; // Si es undefined, usa vacío
const host = process.env.DATABASE_HOST;
const port = process.env.DATABASE_PORT;
const name = process.env.DATABASE_NAME;

// 2. Validar (Opcional, para evitar errores raros si falta algo)
if (!user || !host || !port || !name) {
  throw new Error("Faltan variables de entorno de base de datos (USER, HOST, PORT o NAME).");
}

// 3. Construir la URL dinámica
const connectionString = `mysql://${user}:${password}@${host}:${port}/${name}`;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // 4. Pasar la URL construida en lugar de leer env('DATABASE_URL')
    url: connectionString,
  },
});