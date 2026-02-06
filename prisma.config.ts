import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Load environment variables from .env before Prisma reads datasource config

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is not set. Create a .env file or export it in the shell.',
  );
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: databaseUrl,
  },
});
