import { storage } from "./storage";
import { db } from "./db";
import { forms } from "@shared/schema";
import { sql } from "drizzle-orm";

export async function seedDatabase() {
  const existing = await db.select().from(forms).limit(1);
  if (existing.length > 0) return;

  const form1 = await storage.createForm({
    teamName: "FC Thunder",
    theme: "blue",
    deadline: new Date("2026-06-30"),
    numberRuleUnique: true,
    logoUrl: null,
    shareId: "",
  });

  const jersey1 = await storage.createJersey({
    formId: form1.id,
    name: "Home Jersey 2026",
    price: "189.90",
    modelType: "V-Neck",
    genderType: "unisex",
    imageUrl: null,
  });

  const jersey2 = await storage.createJersey({
    formId: form1.id,
    name: "Away Jersey 2026",
    price: "189.90",
    modelType: "Round Neck",
    genderType: "unisex",
    imageUrl: null,
  });

  const resp1 = await storage.createResponse({
    formId: form1.id,
    athleteName: "Lucas Silva",
    cpf: "123.456.789-00",
    phone: "(11) 99876-5432",
    gender: "male",
  });

  await storage.createJerseyOrder({
    responseId: resp1.id,
    jerseyId: jersey1.id,
    formId: form1.id,
    quantity: 1,
    size: "G",
    number: "10",
    nickname: "LUCAS",
    extraNumbers: null,
  });

  const resp2 = await storage.createResponse({
    formId: form1.id,
    athleteName: "Ana Costa",
    cpf: "987.654.321-00",
    phone: "(21) 98765-4321",
    gender: "female",
  });

  await storage.createJerseyOrder({
    responseId: resp2.id,
    jerseyId: jersey1.id,
    formId: form1.id,
    quantity: 1,
    size: "P",
    number: "07",
    nickname: "ANA",
    extraNumbers: null,
  });

  await storage.createJerseyOrder({
    responseId: resp2.id,
    jerseyId: jersey2.id,
    formId: form1.id,
    quantity: 2,
    size: "P",
    number: "07",
    nickname: "ANA",
    extraNumbers: [{ number: "15", nickname: "COSTA" }],
  });

  const resp3 = await storage.createResponse({
    formId: form1.id,
    athleteName: "Pedro Santos",
    cpf: "456.789.123-00",
    phone: "(31) 97654-3210",
    gender: "male",
  });

  await storage.createJerseyOrder({
    responseId: resp3.id,
    jerseyId: jersey1.id,
    formId: form1.id,
    quantity: 1,
    size: "GG",
    number: "03",
    nickname: "PEDRO",
    extraNumbers: null,
  });

  const form2 = await storage.createForm({
    teamName: "Red Hawks Academy",
    theme: "red",
    deadline: new Date("2026-08-15"),
    numberRuleUnique: true,
    logoUrl: null,
    shareId: "",
  });

  await storage.createJersey({
    formId: form2.id,
    name: "Training Kit",
    price: "149.90",
    modelType: "Dry-Fit",
    genderType: "unisex",
    imageUrl: null,
  });

  console.log("Database seeded successfully");
}
