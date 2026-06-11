import { createDb } from "../src/db/client.ts";

const path = process.env.DATABASE_PATH ?? "./data/reisekontor.db";
createDb({ databasePath: path });
console.log(`Migrationen angewandt auf ${path}`);
