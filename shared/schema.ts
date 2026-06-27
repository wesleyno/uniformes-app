import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, serial, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ===== WORKSPACES & SUB-ADMINS =====
export const workspaces = pgTable("workspaces", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: integer("owner_id"), // null = admin principal
  createdAt: timestamp("created_at").defaultNow(),
});

export const subAdmins = pgTable("sub_admins", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  // Permissões configuráveis
  canManageForms: boolean("can_manage_forms").notNull().default(true),
  canManageCustomers: boolean("can_manage_customers").notNull().default(true),
  canViewReports: boolean("can_view_reports").notNull().default(true),
  canManagePayments: boolean("can_manage_payments").notNull().default(true),
  canConfigureAsaas: boolean("can_configure_asaas").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const paymentSettings = pgTable("payment_settings", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  asaasApiKey: text("asaas_api_key").notNull(),
  environment: text("environment").notNull().default("sandbox"),
  webhookUrl: text("webhook_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const forms = pgTable("forms", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  teamName: text("team_name").notNull(),
  logoUrl: text("logo_url"),
  theme: text("theme").notNull().default("blue"),
  deadline: timestamp("deadline"),
  numberRuleUnique: boolean("number_rule_unique").notNull().default(true),
  supportWhatsapp: text("support_whatsapp"),
  reservationTimeValue: integer("reservation_time_value").notNull().default(5),
  reservationTimeUnit: text("reservation_time_unit").notNull().default("minutes"),
  sponsorDescription: text("sponsor_description"),
  tryonEnabled: boolean("tryon_enabled").notNull().default(false),
  sponsorCarouselEnabled: boolean("sponsor_carousel_enabled").notNull().default(false),
  shareId: varchar("share_id", { length: 32 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const jerseys = pgTable("jerseys", {
  id: serial("id").primaryKey(),
  formId: integer("form_id").notNull().references(() => forms.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  price: text("price").notNull().default("0"),
  modelType: text("model_type").notNull(),
  genderType: text("gender_type").notNull().default("unisex"),
  audienceType: text("audience_type").notNull().default("adult"),
  allowedNumbers: text("allowed_numbers"),
  imageUrl: text("image_url"),
  galleryImages: text("gallery_images").array(),
  description: text("description"),
});

export const responses = pgTable("responses", {
  id: serial("id").primaryKey(),
  formId: integer("form_id").notNull().references(() => forms.id, { onDelete: "cascade" }),
  athleteName: text("athlete_name").notNull(),
  cpf: text("cpf").notNull(),
  phone: text("phone").notNull(),
  gender: text("gender").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const jerseyOrders = pgTable("jersey_orders", {
  id: serial("id").primaryKey(),
  responseId: integer("response_id").notNull().references(() => responses.id, { onDelete: "cascade" }),
  jerseyId: integer("jersey_id").notNull().references(() => jerseys.id, { onDelete: "cascade" }),
  formId: integer("form_id").notNull().references(() => forms.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(1),
  size: text("size").notNull(),
  number: text("number").notNull(),
  nickname: text("nickname").notNull(),
  gender: text("gender").notNull().default("male"),
  extraNumbers: jsonb("extra_numbers").$type<Array<{ number: string; nickname: string; size?: string }>>(),
  paid: boolean("paid").notNull().default(false),
  paidAt: timestamp("paid_at"),
  paymentId: text("payment_id"),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  responseId: integer("response_id").notNull().references(() => responses.id, { onDelete: "cascade" }),
  formId: integer("form_id").notNull().references(() => forms.id, { onDelete: "cascade" }),
  customerName: text("customer_name").notNull(),
  cpf: text("cpf").notNull(),
  phone: text("phone").notNull(),
  totalAmount: text("total_amount").notNull().default("0"),
  paidAmount: text("paid_amount").notNull().default("0"),
  paymentStatus: text("payment_status").notNull().default("PENDING"),
  asaasPaymentId: text("asaas_payment_id"),
  asaasCustomerId: text("asaas_customer_id"),
  asaasPaymentUrl: text("asaas_payment_url"),
  asaasPaymentHistory: jsonb("asaas_payment_history").$type<Array<{ paymentId: string; value: number; url: string | null; creditedAt: string | null }>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const orderPayments = pgTable("order_payments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  asaasPaymentId: text("asaas_payment_id"),
  amount: text("amount").notNull(),
  status: text("status").notNull().default("PENDING"),
  confirmedByAdmin: boolean("confirmed_by_admin").notNull().default(false),
  confirmedAt: timestamp("confirmed_at"),
  confirmedByEmail: text("confirmed_by_email"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const responseAuditLog = pgTable("response_audit_log", {
  id: serial("id").primaryKey(),
  responseId: integer("response_id").notNull().references(() => responses.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  changedBy: text("changed_by").notNull(),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  cpf: text("cpf").notNull().unique(),
  phone: text("phone").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const customerAuditLog = pgTable("customer_audit_log", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  changedBy: text("changed_by").notNull(),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const numberReservations = pgTable("number_reservations", {
  id: serial("id").primaryKey(),
  jerseyId: integer("jersey_id").notNull().references(() => jerseys.id, { onDelete: "cascade" }),
  number: text("number").notNull(),
  gender: text("gender").notNull().default("male"),
  reservedBy: text("reserved_by").notNull(),
  reservedByName: text("reserved_by_name").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const formSponsors = pgTable("form_sponsors", {
  id: serial("id").primaryKey(),
  formId: integer("form_id").notNull().references(() => forms.id, { onDelete: "cascade" }),
  name: text("name").notNull().default(""),
  logoUrl: text("logo_url").notNull(),
  linkUrl: text("link_url"),
  description: text("description"),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sponsorClicks = pgTable("sponsor_clicks", {
  id: serial("id").primaryKey(),
  sponsorId: integer("sponsor_id").notNull().references(() => formSponsors.id, { onDelete: "cascade" }),
  formId: integer("form_id").notNull().references(() => forms.id, { onDelete: "cascade" }),
  clickedAt: timestamp("clicked_at").defaultNow(),
});

export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWorkspaceSchema = createInsertSchema(workspaces).omit({ id: true, createdAt: true });
export const insertSubAdminSchema = createInsertSchema(subAdmins).omit({ id: true, createdAt: true });
export const insertAdminSchema = createInsertSchema(admins).omit({ id: true, createdAt: true });
export const insertPaymentSettingsSchema = createInsertSchema(paymentSettings).omit({ id: true, createdAt: true });
export const insertFormSchema = createInsertSchema(forms).omit({ id: true, createdAt: true });
export const insertJerseySchema = createInsertSchema(jerseys).omit({ id: true });
export const insertResponseSchema = createInsertSchema(responses).omit({ id: true, createdAt: true, updatedAt: true });
export const insertJerseyOrderSchema = createInsertSchema(jerseyOrders).omit({ id: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true });
export const insertOrderPaymentSchema = createInsertSchema(orderPayments).omit({ id: true, createdAt: true });
export const insertAuditLogSchema = createInsertSchema(responseAuditLog).omit({ id: true, createdAt: true });
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCustomerAuditLogSchema = createInsertSchema(customerAuditLog).omit({ id: true, createdAt: true });
export const insertNumberReservationSchema = createInsertSchema(numberReservations).omit({ id: true, createdAt: true });
export const insertFormSponsorSchema = createInsertSchema(formSponsors).omit({ id: true, createdAt: true });
export const insertSponsorClickSchema = createInsertSchema(sponsorClicks).omit({ id: true, clickedAt: true });
export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({ id: true, createdAt: true });

export type Workspace = typeof workspaces.$inferSelect;
export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;
export type SubAdmin = typeof subAdmins.$inferSelect;
export type InsertSubAdmin = z.infer<typeof insertSubAdminSchema>;
export type Admin = typeof admins.$inferSelect;
export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type PaymentSetting = typeof paymentSettings.$inferSelect;
export type InsertPaymentSetting = z.infer<typeof insertPaymentSettingsSchema>;
export type Form = typeof forms.$inferSelect;
export type InsertForm = z.infer<typeof insertFormSchema>;
export type Jersey = typeof jerseys.$inferSelect;
export type InsertJersey = z.infer<typeof insertJerseySchema>;
export type FormResponse = typeof responses.$inferSelect;
export type InsertResponse = z.infer<typeof insertResponseSchema>;
export type JerseyOrder = typeof jerseyOrders.$inferSelect;
export type InsertJerseyOrder = z.infer<typeof insertJerseyOrderSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderPayment = typeof orderPayments.$inferSelect;
export type InsertOrderPayment = z.infer<typeof insertOrderPaymentSchema>;
export type ResponseAuditLog = typeof responseAuditLog.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type CustomerAuditLog = typeof customerAuditLog.$inferSelect;
export type InsertCustomerAuditLog = z.infer<typeof insertCustomerAuditLogSchema>;
export type NumberReservation = typeof numberReservations.$inferSelect;
export type InsertNumberReservation = z.infer<typeof insertNumberReservationSchema>;
export type FormSponsor = typeof formSponsors.$inferSelect;
export type InsertFormSponsor = z.infer<typeof insertFormSponsorSchema>;
export type SponsorClick = typeof sponsorClicks.$inferSelect;
export type InsertSponsorClick = z.infer<typeof insertSponsorClickSchema>;
export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = z.infer<typeof insertSystemSettingSchema>;

// ===== PIX AUTOMÁTICO - PLANOS DE ASSINATURA =====
export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  value: numeric("value", { precision: 10, scale: 2 }).notNull(),
  billingDay: integer("billing_day").notNull().default(10),
  isActive: boolean("is_active").notNull().default(true),
  shareId: varchar("share_id", { length: 32 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => subscriptionPlans.id, { onDelete: "cascade" }),
  workspaceId: integer("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  cpf: text("cpf").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  jerseySize: text("jersey_size"),
  asaasCustomerId: text("asaas_customer_id"),
  asaasAuthorizationId: text("asaas_authorization_id"),
  asaasAuthorizationStatus: text("asaas_authorization_status").notNull().default("PENDING"),
  pixQrCode: text("pix_qr_code"),
  pixPayload: text("pix_payload"),
  pixExpiresAt: timestamp("pix_expires_at"),
  status: text("status").notNull().default("PENDING"),
  cancelledAt: timestamp("cancelled_at"),
  cancelledBy: text("cancelled_by"),
  lastChargeAt: timestamp("last_charge_at"),
  nextChargeAt: timestamp("next_charge_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const subscriptionCharges = pgTable("subscription_charges", {
  id: serial("id").primaryKey(),
  subscriptionId: integer("subscription_id").notNull().references(() => subscriptions.id, { onDelete: "cascade" }),
  asaasPaymentId: text("asaas_payment_id"),
  value: numeric("value", { precision: 10, scale: 2 }).notNull(),
  dueDate: text("due_date").notNull(),
  status: text("status").notNull().default("PENDING"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).omit({ id: true, createdAt: true });
export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, createdAt: true });
export const insertSubscriptionChargeSchema = createInsertSchema(subscriptionCharges).omit({ id: true, createdAt: true });

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type SubscriptionCharge = typeof subscriptionCharges.$inferSelect;
export type InsertSubscriptionCharge = z.infer<typeof insertSubscriptionChargeSchema>;

export const AUDIENCE_TYPES = ["adult", "child", "mixed"] as const;
export type AudienceType = typeof AUDIENCE_TYPES[number];

export const PAYMENT_STATUSES = ["PENDING", "AWAITING_PAYMENT", "PAGAMENTO_PARCIAL", "PAID", "OVERDUE", "CANCELLED", "CANCELLED_BY_ADMIN"] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];

export const MALE_ADULT_SIZES = ["P", "M", "G", "GG", "XG", "XXG"];
export const MALE_CHILD_SIZES = [
  "0 anos", "2 anos", "4 anos", "6 anos", "8 anos", "10 anos",
  "12 anos", "14 anos", "16 anos"
];
export const MALE_SIZES = [...MALE_CHILD_SIZES, ...MALE_ADULT_SIZES];

export const FEMALE_SIZES = ["PP", "P", "M", "G", "GG", "XG"];

export const UNISEX_SIZES = [...new Set([...MALE_SIZES, ...FEMALE_SIZES])];

export const AVAILABLE_NUMBERS = Array.from({ length: 25 }, (_, i) => String(i + 1).padStart(2, "0"));

export const THEMES = [
  { value: "blue", label: "Blue", primary: "#2563eb", accent: "#3b82f6" },
  { value: "red", label: "Red", primary: "#dc2626", accent: "#ef4444" },
  { value: "green", label: "Green", primary: "#16a34a", accent: "#22c55e" },
  { value: "purple", label: "Purple", primary: "#9333ea", accent: "#a855f7" },
  { value: "orange", label: "Orange", primary: "#ea580c", accent: "#f97316" },
  { value: "black", label: "Black", primary: "#1f2937", accent: "#374151" },
];
