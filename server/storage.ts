import {
  type Form, type InsertForm,
  type Jersey, type InsertJersey,
  type FormResponse, type InsertResponse,
  type JerseyOrder, type InsertJerseyOrder,
  type Admin, type InsertAdmin,
  type PaymentSetting, type InsertPaymentSetting,
  type Order, type InsertOrder,
  type OrderPayment, type InsertOrderPayment,
  type ResponseAuditLog, type InsertAuditLog,
  type Customer, type InsertCustomer,
  type CustomerAuditLog, type InsertCustomerAuditLog,
  type NumberReservation, type InsertNumberReservation,
  type FormSponsor, type InsertFormSponsor,
  type SponsorClick, type InsertSponsorClick,
  type SystemSetting,
  type Workspace, type InsertWorkspace,
  type SubAdmin, type InsertSubAdmin,
  type SubscriptionPlan, type InsertSubscriptionPlan,
  type Subscription, type InsertSubscription,
  type SubscriptionCharge, type InsertSubscriptionCharge,
  forms, jerseys, responses, jerseyOrders, admins, paymentSettings, orders, orderPayments, responseAuditLog,
  customers, customerAuditLog, numberReservations, formSponsors, sponsorClicks, systemSettings,
  workspaces, subAdmins, subscriptionPlans, subscriptions, subscriptionCharges
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, gt, lt } from "drizzle-orm";
import { randomBytes } from "crypto";

export interface IStorage {
  createAdmin(admin: InsertAdmin): Promise<Admin>;
  getAdminByEmail(email: string): Promise<Admin | undefined>;
  getAdminCount(): Promise<number>;

  getPaymentSettings(): Promise<PaymentSetting | undefined>;
  upsertPaymentSettings(data: InsertPaymentSetting): Promise<PaymentSetting>;

  createOrder(order: InsertOrder): Promise<Order>;
  getOrder(id: number): Promise<Order | undefined>;
  getOrdersByFormId(formId: number): Promise<Order[]>;
  getOrdersByResponseId(responseId: number): Promise<Order[]>;
  getOrderByCpfPhone(cpf: string, phone: string): Promise<Order[]>;
  getOrdersByCpf(cpf: string): Promise<Order[]>;
  updateOrder(id: number, data: Partial<InsertOrder>): Promise<Order | undefined>;
  getAllOrders(): Promise<Order[]>;

  createForm(form: InsertForm): Promise<Form>;
  getForm(id: number): Promise<Form | undefined>;
  getFormByShareId(shareId: string): Promise<Form | undefined>;
  getAllForms(): Promise<Form[]>;
  updateForm(id: number, data: Partial<InsertForm>): Promise<Form | undefined>;
  deleteForm(id: number): Promise<void>;

  createJersey(jersey: InsertJersey): Promise<Jersey>;
  getJerseysByFormId(formId: number): Promise<Jersey[]>;
  getJersey(id: number): Promise<Jersey | undefined>;
  updateJersey(id: number, data: Partial<InsertJersey>): Promise<Jersey | undefined>;
  deleteJersey(id: number): Promise<void>;

  createResponse(response: InsertResponse): Promise<FormResponse>;
  getResponsesByFormId(formId: number): Promise<FormResponse[]>;
  getResponse(id: number): Promise<FormResponse | undefined>;
  getResponseByCpfPhone(formId: number, cpf: string, phone: string): Promise<FormResponse | undefined>;
  updateResponse(id: number, data: Partial<InsertResponse>): Promise<FormResponse | undefined>;
  deleteResponse(id: number): Promise<void>;

  createJerseyOrder(order: InsertJerseyOrder): Promise<JerseyOrder>;
  getJerseyOrdersByResponseId(responseId: number): Promise<JerseyOrder[]>;
  getJerseyOrdersByFormId(formId: number): Promise<JerseyOrder[]>;
  getJerseyOrder(id: number): Promise<JerseyOrder | undefined>;
  updateJerseyOrder(id: number, data: Partial<InsertJerseyOrder>): Promise<JerseyOrder | undefined>;
  deleteJerseyOrder(id: number): Promise<void>;
  deleteJerseyOrdersByResponseId(responseId: number): Promise<void>;
  getTakenNumbers(formId: number): Promise<Array<{ number: string; athleteName: string; responseId: number; jerseyId: number; orderId?: number; createdAt?: Date | null }>>;

  createAuditLog(log: InsertAuditLog): Promise<ResponseAuditLog>;
  getAuditLogsByResponseId(responseId: number): Promise<ResponseAuditLog[]>;

  createCustomer(customer: InsertCustomer): Promise<Customer>;
  getCustomer(id: number): Promise<Customer | undefined>;
  getCustomerByCpf(cpf: string): Promise<Customer | undefined>;
  getAllCustomers(): Promise<Customer[]>;
  updateCustomer(id: number, data: Partial<InsertCustomer>): Promise<Customer | undefined>;

  createCustomerAuditLog(log: InsertCustomerAuditLog): Promise<CustomerAuditLog>;
  getCustomerAuditLogs(customerId: number): Promise<CustomerAuditLog[]>;

  upsertCustomerFromResponse(name: string, cpf: string, phone: string, changedBy: string): Promise<Customer>;

  createReservation(reservation: InsertNumberReservation): Promise<NumberReservation>;
  deleteReservation(jerseyId: number, number: string, gender?: string): Promise<void>;
  deleteReservationsByReservedBy(reservedBy: string): Promise<void>;
  getReservationsForJersey(jerseyId: number): Promise<NumberReservation[]>;
  getReservationsForForm(formId: number): Promise<NumberReservation[]>;
  cleanExpiredReservations(): Promise<NumberReservation[]>;

  getNumberSelectionsForForm(formId: number): Promise<Array<{
    athleteName: string;
    jerseyName: string;
    number: string;
    size: string;
    createdAt: Date | null;
  }>>;

  createFormSponsor(sponsor: InsertFormSponsor): Promise<FormSponsor>;
  getFormSponsors(formId: number): Promise<FormSponsor[]>;
  updateFormSponsor(id: number, data: Partial<InsertFormSponsor>): Promise<FormSponsor | undefined>;
  deleteFormSponsor(id: number): Promise<void>;
  createSponsorClick(click: InsertSponsorClick): Promise<SponsorClick>;
  getSponsorClickCount(sponsorId: number): Promise<number>;

  createOrderPayment(payment: InsertOrderPayment): Promise<OrderPayment>;
  getOrderPaymentsByOrderId(orderId: number): Promise<OrderPayment[]>;
  updateOrderPayment(id: number, data: Partial<InsertOrderPayment>): Promise<OrderPayment | undefined>;

  getSystemSetting(key: string): Promise<string | null>;
  setSystemSetting(key: string, value: string): Promise<void>;

  // Workspace methods
  createWorkspace(data: InsertWorkspace): Promise<Workspace>;
  getWorkspace(id: number): Promise<Workspace | undefined>;
  getAllWorkspaces(): Promise<Workspace[]>;
  deleteWorkspace(id: number): Promise<void>;

  // SubAdmin methods
  createSubAdmin(data: InsertSubAdmin): Promise<SubAdmin>;
  getSubAdmin(id: number): Promise<SubAdmin | undefined>;
  getSubAdminByEmail(email: string): Promise<SubAdmin | undefined>;
  getAllSubAdmins(): Promise<SubAdmin[]>;
  updateSubAdmin(id: number, data: Partial<InsertSubAdmin>): Promise<SubAdmin | undefined>;
  deleteSubAdmin(id: number): Promise<void>;

  // Workspace-scoped queries
  getFormsByWorkspace(workspaceId: number): Promise<Form[]>;
  getCustomersByWorkspace(workspaceId: number): Promise<Customer[]>;
  getPaymentSettingsByWorkspace(workspaceId: number): Promise<PaymentSetting | undefined>;
  upsertPaymentSettingsByWorkspace(workspaceId: number, data: Omit<InsertPaymentSetting, 'workspaceId'>): Promise<PaymentSetting>;
  getAllOrdersByWorkspace(workspaceId: number): Promise<Order[]>;

  // Subscription Plan methods
  createSubscriptionPlan(data: InsertSubscriptionPlan): Promise<SubscriptionPlan>;
  getSubscriptionPlan(id: number): Promise<SubscriptionPlan | undefined>;
  getSubscriptionPlanByShareId(shareId: string): Promise<SubscriptionPlan | undefined>;
  getAllSubscriptionPlans(workspaceId?: number | null): Promise<SubscriptionPlan[]>;
  updateSubscriptionPlan(id: number, data: Partial<InsertSubscriptionPlan>): Promise<SubscriptionPlan | undefined>;
  deleteSubscriptionPlan(id: number): Promise<void>;

  // Subscription methods
  createSubscription(data: InsertSubscription): Promise<Subscription>;
  getSubscription(id: number): Promise<Subscription | undefined>;
  getSubscriptionsByPlanId(planId: number): Promise<Subscription[]>;
  getSubscriptionsByWorkspace(workspaceId: number): Promise<Subscription[]>;
  getAllSubscriptions(workspaceId?: number | null): Promise<Subscription[]>;
  updateSubscription(id: number, data: Partial<InsertSubscription>): Promise<Subscription | undefined>;
  getActiveSubscriptionsForBilling(): Promise<Subscription[]>;

  // Subscription Charge methods
  createSubscriptionCharge(data: InsertSubscriptionCharge): Promise<SubscriptionCharge>;
  getChargesBySubscriptionId(subscriptionId: number): Promise<SubscriptionCharge[]>;
  updateSubscriptionCharge(id: number, data: Partial<InsertSubscriptionCharge>): Promise<SubscriptionCharge | undefined>;
}

export class DatabaseStorage implements IStorage {
  async createAdmin(admin: InsertAdmin): Promise<Admin> {
    const [created] = await db.insert(admins).values(admin).returning();
    return created;
  }

  async getAdminByEmail(email: string): Promise<Admin | undefined> {
    const [admin] = await db.select().from(admins).where(eq(admins.email, email));
    return admin;
  }

  async getAdminCount(): Promise<number> {
    const result = await db.select().from(admins);
    return result.length;
  }

  async getPaymentSettings(): Promise<PaymentSetting | undefined> {
    const [settings] = await db.select().from(paymentSettings).limit(1);
    return settings;
  }

  async upsertPaymentSettings(data: InsertPaymentSetting): Promise<PaymentSetting> {
    const existing = await this.getPaymentSettings();
    if (existing) {
      const [updated] = await db.update(paymentSettings).set(data).where(eq(paymentSettings.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(paymentSettings).values(data).returning();
    return created;
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [created] = await db.insert(orders).values(order).returning();
    return created;
  }

  async getOrder(id: number): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getOrdersByFormId(formId: number): Promise<Order[]> {
    return db.select().from(orders).where(eq(orders.formId, formId)).orderBy(desc(orders.createdAt));
  }

  async getOrdersByResponseId(responseId: number): Promise<Order[]> {
    return db.select().from(orders).where(eq(orders.responseId, responseId));
  }

  async getOrderByCpfPhone(cpf: string, phone: string): Promise<Order[]> {
    return db.select().from(orders).where(and(eq(orders.cpf, cpf), eq(orders.phone, phone))).orderBy(desc(orders.createdAt));
  }

  async getOrdersByCpf(cpf: string): Promise<Order[]> {
    return db.select().from(orders).where(eq(orders.cpf, cpf)).orderBy(desc(orders.createdAt));
  }

  async updateOrder(id: number, data: Partial<InsertOrder>): Promise<Order | undefined> {
    const [updated] = await db.update(orders).set(data).where(eq(orders.id, id)).returning();
    return updated;
  }

  async getAllOrders(): Promise<Order[]> {
    return db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async createForm(form: InsertForm): Promise<Form> {
    const shareId = randomBytes(8).toString("hex");
    const [created] = await db.insert(forms).values({ ...form, shareId }).returning();
    return created;
  }

  async getForm(id: number): Promise<Form | undefined> {
    const [form] = await db.select().from(forms).where(eq(forms.id, id));
    return form;
  }

  async getFormByShareId(shareId: string): Promise<Form | undefined> {
    const [form] = await db.select().from(forms).where(eq(forms.shareId, shareId));
    return form;
  }

  async getAllForms(): Promise<Form[]> {
    return db.select().from(forms).orderBy(desc(forms.createdAt));
  }

  async updateForm(id: number, data: Partial<InsertForm>): Promise<Form | undefined> {
    const [updated] = await db.update(forms).set(data).where(eq(forms.id, id)).returning();
    return updated;
  }

  async deleteForm(id: number): Promise<void> {
    await db.delete(forms).where(eq(forms.id, id));
  }

  async createJersey(jersey: InsertJersey): Promise<Jersey> {
    const [created] = await db.insert(jerseys).values(jersey).returning();
    return created;
  }

  async getJerseysByFormId(formId: number): Promise<Jersey[]> {
    return db.select().from(jerseys).where(eq(jerseys.formId, formId));
  }

  async getJersey(id: number): Promise<Jersey | undefined> {
    const [jersey] = await db.select().from(jerseys).where(eq(jerseys.id, id));
    return jersey;
  }

  async updateJersey(id: number, data: Partial<InsertJersey>): Promise<Jersey | undefined> {
    const [updated] = await db.update(jerseys).set(data).where(eq(jerseys.id, id)).returning();
    return updated;
  }

  async deleteJersey(id: number): Promise<void> {
    await db.delete(jerseys).where(eq(jerseys.id, id));
  }

  async createResponse(response: InsertResponse): Promise<FormResponse> {
    const [created] = await db.insert(responses).values(response).returning();
    return created;
  }

  async getResponsesByFormId(formId: number): Promise<FormResponse[]> {
    return db.select().from(responses).where(eq(responses.formId, formId)).orderBy(desc(responses.createdAt));
  }

  async getResponse(id: number): Promise<FormResponse | undefined> {
    const [response] = await db.select().from(responses).where(eq(responses.id, id));
    return response;
  }

  async getResponseByCpfPhone(formId: number, cpf: string, phone: string): Promise<FormResponse | undefined> {
    const [response] = await db.select().from(responses)
      .where(and(eq(responses.formId, formId), eq(responses.cpf, cpf), eq(responses.phone, phone)));
    return response;
  }

  async updateResponse(id: number, data: Partial<InsertResponse>): Promise<FormResponse | undefined> {
    const [updated] = await db.update(responses).set({ ...data, updatedAt: new Date() }).where(eq(responses.id, id)).returning();
    return updated;
  }

  async deleteResponse(id: number): Promise<void> {
    await db.delete(jerseyOrders).where(eq(jerseyOrders.responseId, id));
    await db.delete(orders).where(eq(orders.responseId, id));
    await db.delete(responses).where(eq(responses.id, id));
  }

  async createJerseyOrder(order: InsertJerseyOrder): Promise<JerseyOrder> {
    const [created] = await db.insert(jerseyOrders).values(order).returning();
    return created;
  }

  async getJerseyOrdersByResponseId(responseId: number): Promise<JerseyOrder[]> {
    return db.select().from(jerseyOrders).where(eq(jerseyOrders.responseId, responseId));
  }

  async getJerseyOrdersByFormId(formId: number): Promise<JerseyOrder[]> {
    return db.select().from(jerseyOrders).where(eq(jerseyOrders.formId, formId));
  }

  async getJerseyOrder(id: number): Promise<JerseyOrder | undefined> {
    const [found] = await db.select().from(jerseyOrders).where(eq(jerseyOrders.id, id));
    return found;
  }

  async updateJerseyOrder(id: number, data: Partial<InsertJerseyOrder>): Promise<JerseyOrder | undefined> {
    const [updated] = await db.update(jerseyOrders).set(data).where(eq(jerseyOrders.id, id)).returning();
    return updated;
  }

  async deleteJerseyOrder(id: number): Promise<void> {
    await db.delete(jerseyOrders).where(eq(jerseyOrders.id, id));
  }

  async deleteJerseyOrdersByResponseId(responseId: number): Promise<void> {
    await db.delete(jerseyOrders).where(eq(jerseyOrders.responseId, responseId));
  }

  async getTakenNumbers(formId: number): Promise<Array<{ number: string; athleteName: string; responseId: number; jerseyId: number; gender: string; orderId?: number; createdAt?: Date | null }>> {
    const allJerseyOrders = await db.select().from(jerseyOrders).where(eq(jerseyOrders.formId, formId));
    const allResponses = await db.select().from(responses).where(eq(responses.formId, formId));
    const allPaymentOrders = await db.select().from(orders).where(eq(orders.formId, formId));
    
    const responseMap = new Map(allResponses.map(r => [r.id, r]));
    const orderByResponseMap = new Map(allPaymentOrders.map(o => [o.responseId, o]));
    const takenNumbers: Array<{ number: string; athleteName: string; responseId: number; jerseyId: number; gender: string; orderId?: number; createdAt?: Date | null }> = [];
    
    for (const jo of allJerseyOrders) {
      const resp = responseMap.get(jo.responseId);
      const paymentOrder = orderByResponseMap.get(jo.responseId);
      takenNumbers.push({
        number: jo.number,
        athleteName: resp?.athleteName || "Desconhecido",
        responseId: jo.responseId,
        jerseyId: jo.jerseyId,
        gender: jo.gender || resp?.gender || "male",
        orderId: paymentOrder?.id,
        createdAt: resp?.createdAt || null,
      });
      if (jo.extraNumbers) {
        for (const extra of jo.extraNumbers) {
          takenNumbers.push({
            number: extra.number,
            athleteName: resp?.athleteName || "Desconhecido",
            responseId: jo.responseId,
            jerseyId: jo.jerseyId,
            gender: jo.gender || resp?.gender || "male",
            orderId: paymentOrder?.id,
            createdAt: resp?.createdAt || null,
          });
        }
      }
    }
    
    return takenNumbers;
  }

  async createAuditLog(log: InsertAuditLog): Promise<ResponseAuditLog> {
    const [created] = await db.insert(responseAuditLog).values(log).returning();
    return created;
  }

  async getAuditLogsByResponseId(responseId: number): Promise<ResponseAuditLog[]> {
    return db.select().from(responseAuditLog).where(eq(responseAuditLog.responseId, responseId)).orderBy(desc(responseAuditLog.createdAt));
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    const [created] = await db.insert(customers).values(customer).returning();
    return created;
  }

  async getCustomer(id: number): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async getCustomerByCpf(cpf: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.cpf, cpf));
    return customer;
  }

  async getAllCustomers(): Promise<Customer[]> {
    return db.select().from(customers).orderBy(desc(customers.createdAt));
  }

  async updateCustomer(id: number, data: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [updated] = await db.update(customers).set({ ...data, updatedAt: new Date() }).where(eq(customers.id, id)).returning();
    return updated;
  }

  async createCustomerAuditLog(log: InsertCustomerAuditLog): Promise<CustomerAuditLog> {
    const [created] = await db.insert(customerAuditLog).values(log).returning();
    return created;
  }

  async getCustomerAuditLogs(customerId: number): Promise<CustomerAuditLog[]> {
    return db.select().from(customerAuditLog).where(eq(customerAuditLog.customerId, customerId)).orderBy(desc(customerAuditLog.createdAt));
  }

  async createReservation(reservation: InsertNumberReservation): Promise<NumberReservation> {
    await db.delete(numberReservations).where(
      and(eq(numberReservations.jerseyId, reservation.jerseyId), eq(numberReservations.number, reservation.number), eq(numberReservations.gender, reservation.gender || "male"))
    );
    const [created] = await db.insert(numberReservations).values(reservation).returning();
    return created;
  }

  async deleteReservation(jerseyId: number, number: string, gender?: string): Promise<void> {
    const conditions = [eq(numberReservations.jerseyId, jerseyId), eq(numberReservations.number, number)];
    if (gender) conditions.push(eq(numberReservations.gender, gender));
    await db.delete(numberReservations).where(and(...conditions));
  }

  async deleteReservationsByReservedBy(reservedBy: string): Promise<void> {
    await db.delete(numberReservations).where(eq(numberReservations.reservedBy, reservedBy));
  }

  async getReservationsForJersey(jerseyId: number): Promise<NumberReservation[]> {
    return db.select().from(numberReservations)
      .where(and(eq(numberReservations.jerseyId, jerseyId), gt(numberReservations.expiresAt, new Date())));
  }

  async getReservationsForForm(formId: number): Promise<NumberReservation[]> {
    const jerseyList = await this.getJerseysByFormId(formId);
    if (jerseyList.length === 0) return [];
    const allReservations: NumberReservation[] = [];
    for (const jersey of jerseyList) {
      const reservations = await this.getReservationsForJersey(jersey.id);
      allReservations.push(...reservations);
    }
    return allReservations;
  }

  async cleanExpiredReservations(): Promise<NumberReservation[]> {
    const expired = await db.select().from(numberReservations)
      .where(lt(numberReservations.expiresAt, new Date()));
    if (expired.length > 0) {
      await db.delete(numberReservations).where(lt(numberReservations.expiresAt, new Date()));
    }
    return expired;
  }

  async getNumberSelectionsForForm(formId: number): Promise<Array<{
    athleteName: string;
    jerseyName: string;
    number: string;
    size: string;
    createdAt: Date | null;
  }>> {
    const allOrders = await this.getJerseyOrdersByFormId(formId);
    const allResponses = await this.getResponsesByFormId(formId);
    const jerseyList = await this.getJerseysByFormId(formId);
    const responseMap = new Map(allResponses.map(r => [r.id, r]));
    const jerseyMap = new Map(jerseyList.map(j => [j.id, j]));
    const selections: Array<{ athleteName: string; jerseyName: string; number: string; size: string; createdAt: Date | null }> = [];

    for (const order of allOrders) {
      const resp = responseMap.get(order.responseId);
      const jersey = jerseyMap.get(order.jerseyId);
      selections.push({
        athleteName: resp?.athleteName || "Desconhecido",
        jerseyName: jersey?.name || "Camisa removida",
        number: order.number,
        size: order.size,
        createdAt: resp?.createdAt || null,
      });
      if (order.extraNumbers) {
        for (const extra of order.extraNumbers) {
          selections.push({
            athleteName: resp?.athleteName || "Desconhecido",
            jerseyName: jersey?.name || "Camisa removida",
            number: extra.number,
            size: (extra as any).size || order.size,
            createdAt: resp?.createdAt || null,
          });
        }
      }
    }
    return selections;
  }

  async upsertCustomerFromResponse(name: string, cpf: string, phone: string, changedBy: string): Promise<Customer> {
    const existing = await this.getCustomerByCpf(cpf);
    if (existing) {
      const oldValue: Record<string, string> = {};
      const newValue: Record<string, string> = {};
      let changed = false;
      if (existing.name !== name) {
        oldValue.name = existing.name;
        newValue.name = name;
        changed = true;
      }
      if (existing.phone !== phone) {
        oldValue.phone = existing.phone;
        newValue.phone = phone;
        changed = true;
      }
      if (changed) {
        const updated = await this.updateCustomer(existing.id, { name, phone });
        await this.createCustomerAuditLog({
          customerId: existing.id,
          action: "UPDATED",
          changedBy,
          oldValue,
          newValue,
        });
        return updated!;
      }
      return existing;
    }
    const created = await this.createCustomer({ name, cpf, phone });
    await this.createCustomerAuditLog({
      customerId: created.id,
      action: "CREATED",
      changedBy,
      oldValue: null,
      newValue: { name, cpf, phone },
    });
    return created;
  }

  async createFormSponsor(sponsor: InsertFormSponsor): Promise<FormSponsor> {
    const [created] = await db.insert(formSponsors).values(sponsor).returning();
    return created;
  }

  async getFormSponsors(formId: number): Promise<FormSponsor[]> {
    return db.select().from(formSponsors).where(eq(formSponsors.formId, formId)).orderBy(formSponsors.displayOrder);
  }

  async updateFormSponsor(id: number, data: Partial<InsertFormSponsor>): Promise<FormSponsor | undefined> {
    const [updated] = await db.update(formSponsors).set(data).where(eq(formSponsors.id, id)).returning();
    return updated;
  }

  async deleteFormSponsor(id: number): Promise<void> {
    await db.delete(formSponsors).where(eq(formSponsors.id, id));
  }

  async createSponsorClick(click: InsertSponsorClick): Promise<SponsorClick> {
    const [created] = await db.insert(sponsorClicks).values(click).returning();
    return created;
  }

  async getSponsorClickCount(sponsorId: number): Promise<number> {
    const result = await db.select().from(sponsorClicks).where(eq(sponsorClicks.sponsorId, sponsorId));
    return result.length;
  }

  async createOrderPayment(payment: InsertOrderPayment): Promise<OrderPayment> {
    const [created] = await db.insert(orderPayments).values(payment).returning();
    return created;
  }

  async getOrderPaymentsByOrderId(orderId: number): Promise<OrderPayment[]> {
    return db.select().from(orderPayments).where(eq(orderPayments.orderId, orderId)).orderBy(desc(orderPayments.createdAt));
  }

  async updateOrderPayment(id: number, data: Partial<InsertOrderPayment>): Promise<OrderPayment | undefined> {
    const [updated] = await db.update(orderPayments).set(data).where(eq(orderPayments.id, id)).returning();
    return updated;
  }

  async getSystemSetting(key: string): Promise<string | null> {
    const [row] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return row?.value ?? null;
  }

   async setSystemSetting(key: string, value: string): Promise<void> {
    const existing = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    if (existing.length > 0) {
      await db.update(systemSettings).set({ value }).where(eq(systemSettings.key, key));
    } else {
      await db.insert(systemSettings).values({ key, value });
    }
  }

  // ===== WORKSPACE METHODS =====
  async createWorkspace(data: InsertWorkspace): Promise<Workspace> {
    const [created] = await db.insert(workspaces).values(data).returning();
    return created;
  }

  async getWorkspace(id: number): Promise<Workspace | undefined> {
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, id));
    return ws;
  }

  async getAllWorkspaces(): Promise<Workspace[]> {
    return db.select().from(workspaces).orderBy(desc(workspaces.createdAt));
  }

  async deleteWorkspace(id: number): Promise<void> {
    await db.delete(workspaces).where(eq(workspaces.id, id));
  }

  // ===== SUB-ADMIN METHODS =====
  async createSubAdmin(data: InsertSubAdmin): Promise<SubAdmin> {
    const [created] = await db.insert(subAdmins).values(data).returning();
    return created;
  }

  async getSubAdmin(id: number): Promise<SubAdmin | undefined> {
    const [sa] = await db.select().from(subAdmins).where(eq(subAdmins.id, id));
    return sa;
  }

  async getSubAdminByEmail(email: string): Promise<SubAdmin | undefined> {
    const [sa] = await db.select().from(subAdmins).where(eq(subAdmins.email, email));
    return sa;
  }

  async getAllSubAdmins(): Promise<SubAdmin[]> {
    return db.select().from(subAdmins).orderBy(desc(subAdmins.createdAt));
  }

  async updateSubAdmin(id: number, data: Partial<InsertSubAdmin>): Promise<SubAdmin | undefined> {
    const [updated] = await db.update(subAdmins).set(data).where(eq(subAdmins.id, id)).returning();
    return updated;
  }

  async deleteSubAdmin(id: number): Promise<void> {
    await db.delete(subAdmins).where(eq(subAdmins.id, id));
  }

  // ===== WORKSPACE-SCOPED QUERIES =====
  async getFormsByWorkspace(workspaceId: number): Promise<Form[]> {
    return db.select().from(forms).where(eq(forms.workspaceId, workspaceId)).orderBy(desc(forms.createdAt));
  }

  async getCustomersByWorkspace(workspaceId: number): Promise<Customer[]> {
    return db.select().from(customers).where(eq(customers.workspaceId, workspaceId)).orderBy(desc(customers.createdAt));
  }

  async getPaymentSettingsByWorkspace(workspaceId: number): Promise<PaymentSetting | undefined> {
    const [settings] = await db.select().from(paymentSettings).where(eq(paymentSettings.workspaceId, workspaceId)).limit(1);
    return settings;
  }

  async upsertPaymentSettingsByWorkspace(workspaceId: number, data: Omit<InsertPaymentSetting, 'workspaceId'>): Promise<PaymentSetting> {
    const existing = await this.getPaymentSettingsByWorkspace(workspaceId);
    if (existing) {
      const [updated] = await db.update(paymentSettings).set(data).where(eq(paymentSettings.id, existing.id)).returning();
      return updated;
    }
    const [created] = await db.insert(paymentSettings).values({ ...data, workspaceId }).returning();
    return created;
  }

  async getAllOrdersByWorkspace(workspaceId: number): Promise<Order[]> {
    // Orders are linked to forms, which are linked to workspaces
    const workspaceForms = await this.getFormsByWorkspace(workspaceId);
    const formIds = workspaceForms.map(f => f.id);
    if (formIds.length === 0) return [];
    const { inArray } = await import('drizzle-orm');
    return db.select().from(orders).where(inArray(orders.formId, formIds)).orderBy(desc(orders.createdAt));
  }

  // ===== SUBSCRIPTION PLANS =====
  async createSubscriptionPlan(data: InsertSubscriptionPlan): Promise<SubscriptionPlan> {
    const shareId = randomBytes(8).toString('hex');
    const [created] = await db.insert(subscriptionPlans).values({ ...data, shareId }).returning();
    return created;
  }

  async getSubscriptionPlan(id: number): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, id));
    return plan;
  }

  async getSubscriptionPlanByShareId(shareId: string): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.shareId, shareId));
    return plan;
  }

  async getAllSubscriptionPlans(workspaceId?: number | null): Promise<SubscriptionPlan[]> {
    if (workspaceId) {
      return db.select().from(subscriptionPlans).where(eq(subscriptionPlans.workspaceId, workspaceId)).orderBy(desc(subscriptionPlans.createdAt));
    }
    return db.select().from(subscriptionPlans).orderBy(desc(subscriptionPlans.createdAt));
  }

  async updateSubscriptionPlan(id: number, data: Partial<InsertSubscriptionPlan>): Promise<SubscriptionPlan | undefined> {
    const [updated] = await db.update(subscriptionPlans).set(data).where(eq(subscriptionPlans.id, id)).returning();
    return updated;
  }

  async deleteSubscriptionPlan(id: number): Promise<void> {
    await db.delete(subscriptionPlans).where(eq(subscriptionPlans.id, id));
  }

  // ===== SUBSCRIPTIONS =====
  async createSubscription(data: InsertSubscription): Promise<Subscription> {
    const [created] = await db.insert(subscriptions).values(data).returning();
    return created;
  }

  async getSubscription(id: number): Promise<Subscription | undefined> {
    const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.id, id));
    return sub;
  }

  async getSubscriptionsByPlanId(planId: number): Promise<Subscription[]> {
    return db.select().from(subscriptions).where(eq(subscriptions.planId, planId)).orderBy(desc(subscriptions.createdAt));
  }

  async getSubscriptionsByWorkspace(workspaceId: number): Promise<Subscription[]> {
    return db.select().from(subscriptions).where(eq(subscriptions.workspaceId, workspaceId)).orderBy(desc(subscriptions.createdAt));
  }

  async getAllSubscriptions(workspaceId?: number | null): Promise<Subscription[]> {
    if (workspaceId) {
      return db.select().from(subscriptions).where(eq(subscriptions.workspaceId, workspaceId)).orderBy(desc(subscriptions.createdAt));
    }
    return db.select().from(subscriptions).orderBy(desc(subscriptions.createdAt));
  }

  async updateSubscription(id: number, data: Partial<InsertSubscription>): Promise<Subscription | undefined> {
    const [updated] = await db.update(subscriptions).set(data).where(eq(subscriptions.id, id)).returning();
    return updated;
  }

  async getActiveSubscriptionsForBilling(): Promise<Subscription[]> {
    // Retorna assinaturas ativas cuja próxima cobrança é hoje ou no passado
    const now = new Date();
    return db.select().from(subscriptions)
      .where(and(eq(subscriptions.status, 'ACTIVE'), lt(subscriptions.nextChargeAt, now)))
      .orderBy(subscriptions.nextChargeAt);
  }

  // ===== SUBSCRIPTION CHARGES =====
  async createSubscriptionCharge(data: InsertSubscriptionCharge): Promise<SubscriptionCharge> {
    const [created] = await db.insert(subscriptionCharges).values(data).returning();
    return created;
  }

  async getChargesBySubscriptionId(subscriptionId: number): Promise<SubscriptionCharge[]> {
    return db.select().from(subscriptionCharges).where(eq(subscriptionCharges.subscriptionId, subscriptionId)).orderBy(desc(subscriptionCharges.createdAt));
  }

  async updateSubscriptionCharge(id: number, data: Partial<InsertSubscriptionCharge>): Promise<SubscriptionCharge | undefined> {
    const [updated] = await db.update(subscriptionCharges).set(data).where(eq(subscriptionCharges.id, id)).returning();
    return updated;
  }
}
export const storage = new DatabaseStorage();
