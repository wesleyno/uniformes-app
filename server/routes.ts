import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { jerseyOrders, numberReservations } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import bcrypt from "bcrypt";
import { createCustomer, createPayment, getPayment, isConfigured, createPixAutomaticAuthorization, createPixAutomaticCharge, cancelPixAutomaticAuthorization, calcNextDueDate } from "./asaas";
import { WebSocketServer, WebSocket } from "ws";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype) && ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos de imagem são permitidos"));
    }
  },
});

function fileToDataUrl(file: Express.Multer.File): string {
  const base64 = file.buffer.toString("base64");
  return `data:${file.mimetype};base64,${base64}`;
}

const formSchema = z.object({
  teamName: z.string().min(1, "Nome do time é obrigatório"),
  theme: z.string().optional().default("blue"),
  deadline: z.string().optional().nullable(),
  numberRuleUnique: z.union([z.boolean(), z.string()]).optional().default(true),
  supportWhatsapp: z.string().optional().nullable(),
  reservationTimeValue: z.union([z.number(), z.string()]).optional().default(5),
  reservationTimeUnit: z.string().optional().default("minutes"),
  sponsorDescription: z.string().optional().nullable(),
  tryonEnabled: z.union([z.boolean(), z.string()]).optional().default(false),
  sponsorCarouselEnabled: z.union([z.boolean(), z.string()]).optional().default(false),
});

const responseSchema = z.object({
  athleteName: z.string().min(1, "Nome do atleta é obrigatório"),
  cpf: z.string().min(1, "CPF é obrigatório"),
  phone: z.string().min(1, "Telefone é obrigatório"),
  gender: z.enum(["male", "female"], { errorMap: () => ({ message: "Selecione o sexo (Masculino/Feminino)" }) }),
  orders: z.array(z.object({
    jerseyId: z.number(),
    quantity: z.number().min(1),
    size: z.string().min(1),
    number: z.string().min(1),
    nickname: z.string().min(1),
    extraNumbers: z.array(z.object({
      number: z.string().min(1),
      nickname: z.string().min(1),
      size: z.string().optional(),
    })).nullable().optional(),
  })).optional(),
});

declare module "express-session" {
  interface SessionData {
    adminId?: number;
    adminEmail?: string;
    subAdminId?: number;
    subAdminEmail?: string;
    workspaceId?: number;
    isSubAdmin?: boolean;
  }
}

// Middleware: requer admin principal OU sub-admin ativo
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (req.session?.adminId) {
    return next(); // admin principal
  }
  if (req.session?.subAdminId && req.session?.isSubAdmin) {
    return next(); // sub-admin
  }
  return res.status(401).json({ message: "Não autorizado" });
}

// Middleware: requer admin principal (não sub-admin)
function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.adminId) {
    return res.status(403).json({ message: "Apenas o administrador principal pode realizar esta ação" });
  }
  next();
}

// Helper: retorna o workspaceId do usuário logado (null = admin principal, vê tudo)
function getSessionWorkspace(req: Request): number | null {
  if (req.session?.isSubAdmin && req.session?.workspaceId) {
    return req.session.workspaceId;
  }
  return null; // admin principal
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  const uploadDir = path.resolve("uploads");
  app.use("/uploads", (await import("express")).default.static(uploadDir));

  // ===== WEBSOCKET SETUP =====
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  const formClients = new Map<number, Set<WebSocket>>();

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const formId = Number(url.searchParams.get("formId"));
    if (!formId) { ws.close(); return; }

    if (!formClients.has(formId)) formClients.set(formId, new Set());
    formClients.get(formId)!.add(ws);

    ws.on("close", () => {
      formClients.get(formId)?.delete(ws);
      if (formClients.get(formId)?.size === 0) formClients.delete(formId);
    });

    ws.on("error", () => {
      formClients.get(formId)?.delete(ws);
    });
  });

  function broadcast(formId: number, data: any) {
    const clients = formClients.get(formId);
    if (!clients) return;
    const message = JSON.stringify(data);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }

  setInterval(async () => {
    try {
      const expired = await storage.cleanExpiredReservations();
      const formIds = new Set<number>();
      for (const r of expired) {
        const jersey = await storage.getJersey(r.jerseyId);
        if (jersey) {
          formIds.add(jersey.formId);
          broadcast(jersey.formId, { type: "number_released_by_user", jerseyId: r.jerseyId, number: r.number, gender: r.gender || "male" });
        }
      }
    } catch (e) {
      console.error("Reservation cleanup error:", e);
    }
  }, 30000);

  // ===== ADMIN AUTH =====
  app.get("/api/admin/status", async (_req, res) => {
    const count = await storage.getAdminCount();
    res.json({ hasAdmin: count > 0 });
  });

  app.post("/api/admin/register", async (req, res) => {
    try {
      const count = await storage.getAdminCount();
      if (count > 0) {
        return res.status(403).json({ message: "Um administrador já existe" });
      }
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email e senha são obrigatórios" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "A senha deve ter pelo menos 6 caracteres" });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const admin = await storage.createAdmin({ email, passwordHash });
      req.session.adminId = admin.id;
      req.session.adminEmail = admin.email;
      res.json({ id: admin.id, email: admin.email });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.post("/api/admin/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email e senha são obrigatórios" });
      }
      // Tenta login como admin principal
      const admin = await storage.getAdminByEmail(email);
      if (admin) {
        const valid = await bcrypt.compare(password, admin.passwordHash);
        if (!valid) return res.status(401).json({ message: "Credenciais inválidas" });
        req.session.adminId = admin.id;
        req.session.adminEmail = admin.email;
        req.session.isSubAdmin = false;
        return res.json({ id: admin.id, email: admin.email, role: "admin" });
      }
      // Tenta login como sub-admin
      const subAdmin = await storage.getSubAdminByEmail(email);
      if (subAdmin) {
        if (!subAdmin.isActive) return res.status(403).json({ message: "Conta desativada. Entre em contato com o administrador." });
        const valid = await bcrypt.compare(password, subAdmin.passwordHash);
        if (!valid) return res.status(401).json({ message: "Credenciais inválidas" });
        req.session.subAdminId = subAdmin.id;
        req.session.subAdminEmail = subAdmin.email;
        req.session.workspaceId = subAdmin.workspaceId;
        req.session.isSubAdmin = true;
        return res.json({
          id: subAdmin.id,
          email: subAdmin.email,
          name: subAdmin.name,
          role: "subadmin",
          workspaceId: subAdmin.workspaceId,
          permissions: {
            canManageForms: subAdmin.canManageForms,
            canManageCustomers: subAdmin.canManageCustomers,
            canViewReports: subAdmin.canViewReports,
            canManagePayments: subAdmin.canManagePayments,
            canConfigureAsaas: subAdmin.canConfigureAsaas,
          }
        });
      }
      return res.status(401).json({ message: "Credenciais inválidas" });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/admin/me", async (req, res) => {
    if (req.session?.adminId) {
      return res.json({ id: req.session.adminId, email: req.session.adminEmail, role: "admin" });
    }
    if (req.session?.subAdminId && req.session?.isSubAdmin) {
      const subAdmin = await storage.getSubAdmin(req.session.subAdminId);
      if (!subAdmin || !subAdmin.isActive) {
        req.session.destroy(() => {});
        return res.status(401).json({ message: "Conta desativada" });
      }
      return res.json({
        id: subAdmin.id,
        email: subAdmin.email,
        name: subAdmin.name,
        role: "subadmin",
        workspaceId: subAdmin.workspaceId,
        permissions: {
          canManageForms: subAdmin.canManageForms,
          canManageCustomers: subAdmin.canManageCustomers,
          canViewReports: subAdmin.canViewReports,
          canManagePayments: subAdmin.canManagePayments,
          canConfigureAsaas: subAdmin.canConfigureAsaas,
        }
      });
    }
    return res.status(401).json({ message: "Não autorizado" });
  });

  app.post("/api/admin/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ message: "Erro ao fazer logout" });
      res.json({ success: true });
    });
  });

  // ===== PAYMENT SETTINGS (protected) =====
  app.get("/api/admin/payment-settings", requireAuth, async (req, res) => {
    const workspaceId = getSessionWorkspace(req);
    const settings = workspaceId
      ? await storage.getPaymentSettingsByWorkspace(workspaceId)
      : await storage.getPaymentSettings();
    if (!settings) return res.json(null);
    res.json({
      id: settings.id,
      environment: settings.environment,
      webhookUrl: settings.webhookUrl,
      hasApiKey: !!settings.asaasApiKey,
      createdAt: settings.createdAt,
    });
  });

  app.post("/api/admin/payment-settings", requireAuth, async (req, res) => {
    try {
      const { asaasApiKey, environment, webhookUrl } = req.body;
      if (!asaasApiKey) {
        return res.status(400).json({ message: "API Key é obrigatória" });
      }
      const workspaceId = getSessionWorkspace(req);
      let settings;
      if (workspaceId) {
        settings = await storage.upsertPaymentSettingsByWorkspace(workspaceId, {
          asaasApiKey,
          environment: environment || "sandbox",
          webhookUrl: webhookUrl || null,
        });
      } else {
        settings = await storage.upsertPaymentSettings({
          asaasApiKey,
          environment: environment || "sandbox",
          webhookUrl: webhookUrl || null,
        });
      }
      res.json({
        id: settings.id,
        environment: settings.environment,
        webhookUrl: settings.webhookUrl,
        hasApiKey: !!settings.asaasApiKey,
        createdAt: settings.createdAt,
      });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // ===== FORMS (protected except share) =====
  app.get("/api/forms", requireAuth, async (req, res) => {
    const workspaceId = getSessionWorkspace(req);
    const allForms = workspaceId
      ? await storage.getFormsByWorkspace(workspaceId)
      : await storage.getAllForms();
    res.json(allForms);
  });

  app.get("/api/forms/share/:shareId", async (req, res) => {
    const form = await storage.getFormByShareId(req.params.shareId);
    if (!form) return res.status(404).json({ message: "Formulário não encontrado" });
    res.json(form);
  });

  app.get("/api/forms/:id", requireAuth, async (req, res) => {
    const form = await storage.getForm(Number(req.params.id));
    if (!form) return res.status(404).json({ message: "Formulário não encontrado" });
    res.json(form);
  });

  app.post("/api/forms", requireAuth, upload.single("logo"), async (req, res) => {
    try {
      const parsed = formSchema.parse(req.body);
      const logoUrl = req.file ? fileToDataUrl(req.file) : null;
      const workspaceId = getSessionWorkspace(req);
      const form = await storage.createForm({
        teamName: parsed.teamName,
        theme: parsed.theme || "blue",
        deadline: parsed.deadline ? new Date(parsed.deadline) : null,
        numberRuleUnique: parsed.numberRuleUnique === "true" || parsed.numberRuleUnique === true,
        supportWhatsapp: parsed.supportWhatsapp ? parsed.supportWhatsapp.replace(/\D/g, "") : null,
        reservationTimeValue: Number(parsed.reservationTimeValue) || 5,
        reservationTimeUnit: parsed.reservationTimeUnit || "minutes",
        sponsorDescription: parsed.sponsorDescription || null,
        tryonEnabled: parsed.tryonEnabled === "true" || parsed.tryonEnabled === true,
        sponsorCarouselEnabled: parsed.sponsorCarouselEnabled === "true" || parsed.sponsorCarouselEnabled === true,
        logoUrl,
        shareId: "",
        workspaceId: workspaceId || null,
      });
      res.json(form);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/forms/:id", requireAuth, upload.single("logo"), async (req, res) => {
    try {
      const parsed = formSchema.parse(req.body);
      const data: any = {
        teamName: parsed.teamName,
        theme: parsed.theme,
        deadline: parsed.deadline ? new Date(parsed.deadline) : null,
        numberRuleUnique: parsed.numberRuleUnique === "true" || parsed.numberRuleUnique === true,
        supportWhatsapp: parsed.supportWhatsapp ? parsed.supportWhatsapp.replace(/\D/g, "") : null,
        reservationTimeValue: Number(parsed.reservationTimeValue) || 5,
        reservationTimeUnit: parsed.reservationTimeUnit || "minutes",
        sponsorDescription: parsed.sponsorDescription || null,
        tryonEnabled: parsed.tryonEnabled === "true" || parsed.tryonEnabled === true,
        sponsorCarouselEnabled: parsed.sponsorCarouselEnabled === "true" || parsed.sponsorCarouselEnabled === true,
      };
      if (req.file) {
        data.logoUrl = fileToDataUrl(req.file);
      }
      const form = await storage.updateForm(Number(req.params.id), data);
      if (!form) return res.status(404).json({ message: "Formulário não encontrado" });
      res.json(form);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/forms/:id", requireAuth, async (req, res) => {
    await storage.deleteForm(Number(req.params.id));
    res.json({ success: true });
  });

  // ===== FORM SPONSORS =====
  app.get("/api/forms/:formId/sponsors", async (req, res) => {
    const sponsors = await storage.getFormSponsors(Number(req.params.formId));
    res.json(sponsors);
  });

  app.post("/api/forms/:formId/sponsors", requireAuth, upload.single("logo"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "Logo do patrocinador é obrigatório" });
      const logoUrl = fileToDataUrl(req.file);
      const sponsor = await storage.createFormSponsor({
        formId: Number(req.params.formId),
        name: req.body.name || "",
        logoUrl,
        linkUrl: req.body.linkUrl || null,
        description: req.body.description || null,
        displayOrder: parseInt(req.body.displayOrder) || 0,
      });
      res.json(sponsor);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/sponsors/:id", requireAuth, upload.single("logo"), async (req, res) => {
    try {
      const data: any = {};
      if (req.body.name !== undefined) data.name = req.body.name;
      if (req.body.linkUrl !== undefined) data.linkUrl = req.body.linkUrl;
      if (req.body.description !== undefined) data.description = req.body.description;
      if (req.body.displayOrder !== undefined) data.displayOrder = parseInt(req.body.displayOrder) || 0;
      if (req.file) data.logoUrl = fileToDataUrl(req.file);
      const updated = await storage.updateFormSponsor(Number(req.params.id), data);
      if (!updated) return res.status(404).json({ message: "Patrocinador não encontrado" });
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/sponsors/:id", requireAuth, async (req, res) => {
    await storage.deleteFormSponsor(Number(req.params.id));
    res.json({ success: true });
  });

  app.post("/api/sponsors/:sponsorId/click", async (req, res) => {
    try {
      const sponsorId = Number(req.params.sponsorId);
      const formId = Number(req.body.formId);
      if (!formId) return res.status(400).json({ message: "formId é obrigatório" });
      const sponsors = await storage.getFormSponsors(formId);
      const sponsorExists = sponsors.some(s => s.id === sponsorId);
      if (!sponsorExists) return res.status(400).json({ message: "Patrocinador não pertence a este formulário" });
      await storage.createSponsorClick({ sponsorId, formId });
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/admin/sponsors/:sponsorId/clicks", requireAuth, async (req, res) => {
    const count = await storage.getSponsorClickCount(Number(req.params.sponsorId));
    res.json({ count });
  });

  // ===== PRIVACY POLICY =====
  app.get("/api/privacy-policy", async (_req, res) => {
    const value = await storage.getSystemSetting("privacy_policy");
    res.json({ content: value || "" });
  });

  app.get("/api/admin/privacy-policy", requireAuth, async (_req, res) => {
    const value = await storage.getSystemSetting("privacy_policy");
    res.json({ content: value || "" });
  });

  app.put("/api/admin/privacy-policy", requireAuth, async (req, res) => {
    const { content } = req.body;
    if (typeof content !== "string") return res.status(400).json({ message: "Conteúdo inválido" });
    await storage.setSystemSetting("privacy_policy", content);
    res.json({ success: true });
  });

  // ===== JERSEYS =====
  app.get("/api/forms/:formId/jerseys", async (req, res) => {
    const jerseyList = await storage.getJerseysByFormId(Number(req.params.formId));
    res.json(jerseyList);
  });

  app.post("/api/forms/:formId/jerseys", requireAuth, upload.fields([
    { name: "image", maxCount: 1 },
    { name: "galleryImages", maxCount: 10 },
  ]), async (req, res) => {
    try {
      const body = req.body;
      if (!body.name || !body.modelType) {
        return res.status(400).json({ message: "Nome e tipo de modelo são obrigatórios" });
      }
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const imageUrl = files?.image?.[0] ? fileToDataUrl(files.image[0]) : null;
      const galleryImages = files?.galleryImages?.map(f => fileToDataUrl(f)) || [];
      const jersey = await storage.createJersey({
        formId: Number(req.params.formId),
        name: body.name,
        price: body.price || "0",
        modelType: body.modelType,
        genderType: body.genderType || "unisex",
        audienceType: body.audienceType || "adult",
        imageUrl,
        galleryImages: galleryImages.length > 0 ? galleryImages : null,
        description: body.description || null,
        allowedNumbers: body.allowedNumbers || null,
      });
      res.json(jersey);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/jerseys/:id", requireAuth, upload.fields([
    { name: "image", maxCount: 1 },
    { name: "galleryImages", maxCount: 10 },
  ]), async (req, res) => {
    try {
      const body = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const data: any = {
        name: body.name,
        price: body.price,
        modelType: body.modelType,
        genderType: body.genderType,
        audienceType: body.audienceType,
      };
      if (files?.image?.[0]) {
        data.imageUrl = fileToDataUrl(files.image[0]);
      }
      if (files?.galleryImages && files.galleryImages.length > 0) {
        const existing = body.existingGalleryImages ? JSON.parse(body.existingGalleryImages) : [];
        data.galleryImages = [...existing, ...files.galleryImages.map(f => fileToDataUrl(f))];
      } else if (body.existingGalleryImages) {
        data.galleryImages = JSON.parse(body.existingGalleryImages);
      }
      if (body.description !== undefined) {
        data.description = body.description || null;
      }
      if (body.allowedNumbers !== undefined) {
        data.allowedNumbers = body.allowedNumbers || null;
      }
      const jersey = await storage.updateJersey(Number(req.params.id), data);
      if (!jersey) return res.status(404).json({ message: "Camiseta não encontrada" });
      res.json(jersey);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/jerseys/:id", requireAuth, async (req, res) => {
    await storage.deleteJersey(Number(req.params.id));
    res.json({ success: true });
  });

  // ===== RESPONSES =====
  app.get("/api/forms/:formId/responses", requireAuth, async (req, res) => {
    const responsesList = await storage.getResponsesByFormId(Number(req.params.formId));
    res.json(responsesList);
  });

  app.get("/api/responses/:id", requireAuth, async (req, res) => {
    const response = await storage.getResponse(Number(req.params.id));
    if (!response) return res.status(404).json({ message: "Resposta não encontrada" });
    res.json(response);
  });

  app.post("/api/forms/:formId/responses", async (req, res) => {
    try {
      const parsed = responseSchema.parse(req.body);
      const formId = Number(req.params.formId);
      parsed.cpf = parsed.cpf.replace(/\D/g, "");
      parsed.phone = parsed.phone.replace(/\D/g, "");

      const form = await storage.getForm(formId);
      if (!form) return res.status(404).json({ message: "Formulário não encontrado" });
      
      const existing = await storage.getResponseByCpfPhone(formId, parsed.cpf, parsed.phone);
      if (existing) {
        return res.status(409).json({ 
          message: "Já existe uma resposta para este CPF e telefone",
          existingId: existing.id 
        });
      }

      if (form.numberRuleUnique && parsed.orders) {
        const takenNumbers = await storage.getTakenNumbers(formId);
        for (const order of parsed.orders) {
          const conflict = takenNumbers.find(
            t => t.number === order.number && t.jerseyId === order.jerseyId && t.gender === (parsed.gender || "male")
          );
          if (conflict) {
            return res.status(400).json({ 
              message: `Número ${order.number} já escolhido para essa camiseta por ${conflict.athleteName}` 
            });
          }
          if (order.extraNumbers) {
            for (const extra of order.extraNumbers) {
              const extraConflict = takenNumbers.find(
                t => t.number === extra.number && t.jerseyId === order.jerseyId && t.gender === (parsed.gender || "male")
              );
              if (extraConflict) {
                return res.status(400).json({ 
                  message: `Número ${extra.number} já escolhido para essa camiseta por ${extraConflict.athleteName}` 
                });
              }
            }
          }
        }
      }

      const response = await storage.createResponse({ 
        formId, 
        athleteName: (parsed.athleteName || "").toUpperCase(), 
        cpf: parsed.cpf, 
        phone: parsed.phone, 
        gender: parsed.gender 
      });
      
      let totalAmount = 0;
      if (parsed.orders && Array.isArray(parsed.orders)) {
        const jerseyList = await storage.getJerseysByFormId(formId);
        const jerseyMap = new Map(jerseyList.map(j => [j.id, j]));
        
        for (const order of parsed.orders) {
          await storage.createJerseyOrder({
            responseId: response.id,
            jerseyId: order.jerseyId,
            formId,
            quantity: order.quantity,
            size: order.size,
            number: order.number,
            nickname: (order.nickname || "").toUpperCase(),
            gender: parsed.gender || "male",
            extraNumbers: order.extraNumbers || null,
          });
          const jersey = jerseyMap.get(order.jerseyId);
          if (jersey) {
            totalAmount += (parseFloat(jersey.price) || 0) * order.quantity;
          }
        }
      }

      let orderRecord = null;
      try {
        const payConfigured = await isConfigured();
        if (totalAmount > 0 && payConfigured) {
          const customer = await createCustomer(parsed.athleteName, parsed.cpf, parsed.phone);
          const dueDate = form.deadline
            ? new Date(form.deadline).toISOString().split("T")[0]
            : new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
          orderRecord = await storage.createOrder({
            responseId: response.id,
            formId,
            customerName: parsed.athleteName,
            cpf: parsed.cpf,
            phone: parsed.phone,
            totalAmount: totalAmount.toFixed(2),
            paidAmount: "0",
            paymentStatus: "AWAITING_PAYMENT",
            asaasPaymentId: null,
            asaasCustomerId: customer.id,
            asaasPaymentUrl: null,
          });
          const paymentDesc = `Uniforme ${form.teamName} - Pedido #${orderRecord.id} - ${parsed.athleteName}`;
          const payment = await createPayment(
            customer.id,
            totalAmount,
            paymentDesc,
            dueDate
          );
          const payUrl = payment.invoiceUrl || payment.bankSlipUrl || null;
          orderRecord = await storage.updateOrder(orderRecord.id, {
            asaasPaymentId: payment.id,
            asaasPaymentUrl: payUrl,
            asaasPaymentHistory: [{ paymentId: payment.id, value: totalAmount, url: payUrl, creditedAt: null }] as any,
          });
        } else {
          orderRecord = await storage.createOrder({
            responseId: response.id,
            formId,
            customerName: parsed.athleteName,
            cpf: parsed.cpf,
            phone: parsed.phone,
            totalAmount: totalAmount.toFixed(2),
            paidAmount: "0",
            paymentStatus: totalAmount > 0 ? "PENDING" : "PAID",
            asaasPaymentId: null,
            asaasCustomerId: null,
            asaasPaymentUrl: null,
          });
        }
      } catch (payErr: any) {
        console.error("Payment creation error:", payErr.message);
        orderRecord = await storage.createOrder({
          responseId: response.id,
          formId,
          customerName: parsed.athleteName,
          cpf: parsed.cpf,
          phone: parsed.phone,
          totalAmount: totalAmount.toFixed(2),
          paidAmount: "0",
          paymentStatus: "PENDING",
          asaasPaymentId: null,
          asaasCustomerId: null,
          asaasPaymentUrl: null,
        });
      }

      await storage.createAuditLog({
        responseId: response.id,
        action: "CREATED",
        changedBy: "system",
        oldValue: null,
        newValue: { athleteName: parsed.athleteName, cpf: parsed.cpf, phone: parsed.phone, gender: parsed.gender, orders: parsed.orders || [] },
      });

      try {
        await storage.upsertCustomerFromResponse(parsed.athleteName, parsed.cpf, parsed.phone, "system");
      } catch (custErr: any) {
        console.error("Customer upsert error:", custErr.message);
      }

      try {
        await storage.deleteReservationsByReservedBy(parsed.cpf);
      } catch {}
      if (parsed.orders) {
        for (const order of parsed.orders) {
          broadcast(formId, { type: "number_confirmed", jerseyId: order.jerseyId, number: order.number, gender: parsed.gender || "male", athleteName: parsed.athleteName });
          if (order.extraNumbers) {
            for (const extra of order.extraNumbers) {
              broadcast(formId, { type: "number_confirmed", jerseyId: order.jerseyId, number: extra.number, gender: parsed.gender || "male", athleteName: parsed.athleteName });
            }
          }
        }
      }

      res.json({ ...response, order: orderRecord });
    } catch (e: any) {
      console.error("Response submission error:", e.message, e.errors || e.issues || "");
      if (e.message?.includes("já escolhido")) {
        res.status(400).json({ message: e.message });
      } else if (e.issues) {
        const fieldErrors = e.issues.map((i: any) => `${i.path?.join(".")}: ${i.message}`).join("; ");
        res.status(400).json({ message: `Dados inválidos: ${fieldErrors}` });
      } else {
        res.status(400).json({ message: e.message || "Erro ao enviar resposta. Verifique os dados e tente novamente." });
      }
    }
  });

  app.post("/api/forms/:formId/responses/lookup", async (req, res) => {
    const { cpf, phone } = req.body;
    if (!cpf || !phone) return res.status(400).json({ message: "CPF and phone are required" });
    const formId = Number(req.params.formId);
    const normalizedCpf = cpf.replace(/\D/g, "");
    const normalizedPhone = phone.replace(/\D/g, "");
    const existing = await storage.getResponseByCpfPhone(formId, normalizedCpf, normalizedPhone);
    if (!existing) return res.status(404).json({ message: "Resposta não encontrada para este CPF" });
    const jerseyOrdersList = await storage.getJerseyOrdersByResponseId(existing.id);
    res.json({ response: existing, orders: jerseyOrdersList });
  });

  app.put("/api/responses/:id", async (req, res) => {
    try {
      const parsed = responseSchema.parse(req.body);
      const responseId = Number(req.params.id);
      parsed.cpf = parsed.cpf.replace(/\D/g, "");
      parsed.phone = parsed.phone.replace(/\D/g, "");
      
      const existingResponse = await storage.getResponse(responseId);
      if (!existingResponse) return res.status(404).json({ message: "Resposta não encontrada" });
      const existingJerseyOrders = await storage.getJerseyOrdersByResponseId(responseId);

      const form = await storage.getForm(existingResponse.formId);
      if (form && form.numberRuleUnique && parsed.orders) {
        const takenNumbers = await storage.getTakenNumbers(form.id);
        const takenFiltered = takenNumbers.filter(t => t.responseId !== responseId);
        
        for (const order of parsed.orders) {
          const conflict = takenFiltered.find(
            t => t.number === order.number && t.jerseyId === order.jerseyId && t.gender === (parsed.gender || "male")
          );
          if (conflict) {
            return res.status(400).json({ 
              message: `Número ${order.number} já escolhido para essa camiseta por ${conflict.athleteName}` 
            });
          }
          if (order.extraNumbers) {
            for (const extra of order.extraNumbers) {
              const extraConflict = takenFiltered.find(
                t => t.number === extra.number && t.jerseyId === order.jerseyId && t.gender === (parsed.gender || "male")
              );
              if (extraConflict) {
                return res.status(400).json({ 
                  message: `Número ${extra.number} já escolhido para essa camiseta por ${extraConflict.athleteName}` 
                });
              }
            }
          }
        }
      }

      const updated = await storage.updateResponse(responseId, { 
        athleteName: (parsed.athleteName || "").toUpperCase(), 
        cpf: parsed.cpf, 
        phone: parsed.phone, 
        gender: parsed.gender 
      });
      if (!updated) return res.status(404).json({ message: "Resposta não encontrada" });

      const currentJerseyOrders = await storage.getJerseyOrdersByResponseId(responseId);
      const paidJerseyOrders = currentJerseyOrders.filter(jo => jo.paid);
      const unpaidJerseyOrders = currentJerseyOrders.filter(jo => !jo.paid);

      for (const ujo of unpaidJerseyOrders) {
        await storage.deleteJerseyOrder(ujo.id);
      }

      for (const pjo of paidJerseyOrders) {
        const matchingNewOrder = (parsed.orders || []).find(
          (o: any) => o.existingJerseyOrderId === pjo.id || (o.jerseyId === pjo.jerseyId && o.number === pjo.number)
        );
        if (matchingNewOrder) {
          const allowedUpdates: any = {};
          if (matchingNewOrder.size && matchingNewOrder.size !== pjo.size) allowedUpdates.size = matchingNewOrder.size;
          if (matchingNewOrder.number && matchingNewOrder.number !== pjo.number) allowedUpdates.number = matchingNewOrder.number;
          if (matchingNewOrder.nickname && (matchingNewOrder.nickname || "").toUpperCase() !== pjo.nickname) allowedUpdates.nickname = (matchingNewOrder.nickname || "").toUpperCase();
          if (Object.keys(allowedUpdates).length > 0) {
            await storage.updateJerseyOrder(pjo.id, allowedUpdates);
          }
          if (matchingNewOrder.quantity !== undefined && matchingNewOrder.quantity !== pjo.quantity) {
            await storage.createAuditLog({
              responseId,
              action: "PAID_ITEM_PROTECTED",
              changedBy: req.session?.adminId ? (req.session.adminEmail || "admin") : "athlete",
              oldValue: { jerseyOrderId: pjo.id, quantity: pjo.quantity },
              newValue: { message: "Item pago protegido contra alteração de quantidade", attemptedQuantity: matchingNewOrder.quantity },
            });
          }
        }
      }

      const paidJerseyIds = new Set(paidJerseyOrders.map(pjo => pjo.id));

      if (parsed.orders && Array.isArray(parsed.orders)) {
        for (const order of parsed.orders) {
          const matchesPaid = paidJerseyOrders.some(
            pjo => (order.existingJerseyOrderId === pjo.id) || (order.jerseyId === pjo.jerseyId && order.number === pjo.number)
          );
          if (!matchesPaid) {
            await storage.createJerseyOrder({
              responseId,
              jerseyId: order.jerseyId,
              formId: updated.formId,
              quantity: order.quantity,
              size: order.size,
              number: order.number,
              nickname: (order.nickname || "").toUpperCase(),
              gender: parsed.gender || updated.gender || "male",
              extraNumbers: order.extraNumbers || null,
            });
          }
        }
      }

      let totalAmount = 0;
      if (form) {
        const jerseyListForCalc = await storage.getJerseysByFormId(form.id);
        const jerseyMap = new Map(jerseyListForCalc.map(j => [j.id, j]));
        const allCurrentJerseyOrders = await storage.getJerseyOrdersByResponseId(responseId);
        for (const jo of allCurrentJerseyOrders) {
          const jersey = jerseyMap.get(jo.jerseyId);
          if (jersey) {
            totalAmount += (parseFloat(jersey.price) || 0) * jo.quantity;
          }
        }
      }

      const existingOrders = await storage.getOrdersByResponseId(responseId);
      let orderRecord = existingOrders.length > 0 ? existingOrders[0] : null;

      if (orderRecord) {
        const oldTotal = parseFloat(orderRecord.totalAmount) || 0;
        const newTotal = totalAmount;
        const paidAmount = parseFloat(orderRecord.paidAmount) || 0;
        const wasPaid = ["PAID", "RECEIVED", "CONFIRMED"].includes(orderRecord.paymentStatus);

        const updateData: any = {
          customerName: (parsed.athleteName || "").toUpperCase(),
          cpf: parsed.cpf,
          phone: parsed.phone,
          totalAmount: newTotal.toFixed(2),
        };

        if (wasPaid || paidAmount > 0) {
          const saldoPendente = newTotal - paidAmount;
          if (saldoPendente > 0.01) {
            updateData.paymentStatus = "PAGAMENTO_PARCIAL";

            try {
              const payConfigured = await isConfigured();
              if (payConfigured && form) {
                const customerId = orderRecord.asaasCustomerId || (await createCustomer(parsed.athleteName, parsed.cpf, parsed.phone)).id;
                const dueDate = form.deadline
                  ? new Date(form.deadline).toISOString().split("T")[0]
                  : new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
                const diffDesc = `Diferença do pedido #${orderRecord.id} - Uniforme ${form.teamName}`;
                const diffPayment = await createPayment(customerId, saldoPendente, diffDesc, dueDate);

                const currentHistory = (orderRecord.asaasPaymentHistory || []) as Array<{ paymentId: string; value: number; url: string | null; creditedAt: string | null }>;
                const newHistory = [...currentHistory, { paymentId: diffPayment.id, value: saldoPendente, url: diffPayment.invoiceUrl || diffPayment.bankSlipUrl || null, creditedAt: null }];

                updateData.asaasPaymentId = diffPayment.id;
                updateData.asaasPaymentUrl = diffPayment.invoiceUrl || diffPayment.bankSlipUrl || null;
                updateData.asaasPaymentHistory = newHistory;
              }
            } catch (payErr: any) {
              console.error("Difference payment creation error:", payErr.message);
            }

            await storage.createAuditLog({
              responseId,
              action: "PAYMENT_DIFF",
              changedBy: req.session?.adminId ? (req.session.adminEmail || "admin") : "athlete",
              oldValue: { totalAmount: oldTotal.toFixed(2), paidAmount: paidAmount.toFixed(2) },
              newValue: { totalAmount: newTotal.toFixed(2), paidAmount: paidAmount.toFixed(2), saldoPendente: saldoPendente.toFixed(2), message: "Pedido editado após pagamento. Novo saldo pendente gerado." },
            });
          } else if (saldoPendente <= 0.01) {
            updateData.paymentStatus = "PAID";
          }
        }

        orderRecord = await storage.updateOrder(orderRecord.id, updateData) || orderRecord;
      } else if (totalAmount > 0 && form) {
        try {
          const payConfigured = await isConfigured();
          if (payConfigured) {
            const customer = await createCustomer(parsed.athleteName, parsed.cpf, parsed.phone);
            const dueDate = form.deadline
              ? new Date(form.deadline).toISOString().split("T")[0]
              : new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
            orderRecord = await storage.createOrder({
              responseId,
              formId: form.id,
              customerName: (parsed.athleteName || "").toUpperCase(),
              cpf: parsed.cpf,
              phone: parsed.phone,
              totalAmount: totalAmount.toFixed(2),
              paidAmount: "0",
              paymentStatus: "AWAITING_PAYMENT",
              asaasPaymentId: null,
              asaasCustomerId: customer.id,
              asaasPaymentUrl: null,
            });
            const paymentDesc = `Uniforme ${form.teamName} - Pedido #${orderRecord.id} - ${parsed.athleteName}`;
            const payment = await createPayment(customer.id, totalAmount, paymentDesc, dueDate);
            orderRecord = await storage.updateOrder(orderRecord.id, {
              asaasPaymentId: payment.id,
              asaasPaymentUrl: payment.invoiceUrl || payment.bankSlipUrl || null,
            }) || orderRecord;
          } else {
            orderRecord = await storage.createOrder({
              responseId,
              formId: form.id,
              customerName: (parsed.athleteName || "").toUpperCase(),
              cpf: parsed.cpf,
              phone: parsed.phone,
              totalAmount: totalAmount.toFixed(2),
              paidAmount: "0",
              paymentStatus: "PENDING",
              asaasPaymentId: null,
              asaasCustomerId: null,
              asaasPaymentUrl: null,
            });
          }
        } catch (payErr: any) {
          console.error("Payment creation error on edit:", payErr.message);
        }
      }

      const isAdmin = !!req.session?.adminId;
      const changedBy = isAdmin ? req.session.adminEmail || "admin" : "athlete";
      await storage.createAuditLog({
        responseId,
        action: isAdmin ? "ADMIN_EDIT" : "UPDATED",
        changedBy,
        oldValue: { athleteName: existingResponse.athleteName, cpf: existingResponse.cpf, phone: existingResponse.phone, gender: existingResponse.gender, orders: existingJerseyOrders },
        newValue: { athleteName: parsed.athleteName, cpf: parsed.cpf, phone: parsed.phone, gender: parsed.gender, orders: parsed.orders || [] },
      });

      try {
        await storage.upsertCustomerFromResponse(parsed.athleteName, parsed.cpf, parsed.phone, changedBy);
      } catch (custErr: any) {
        console.error("Customer upsert error:", custErr.message);
      }

      res.json({ ...updated, order: orderRecord });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/responses/:id", requireAuth, async (req, res) => {
    const responseToDelete = await storage.getResponse(Number(req.params.id));
    if (responseToDelete) {
      const jerseyOrdersToDelete = await storage.getJerseyOrdersByResponseId(responseToDelete.id);
      await storage.createAuditLog({
        responseId: responseToDelete.id,
        action: "DELETED",
        changedBy: req.session?.adminEmail || "admin",
        oldValue: { athleteName: responseToDelete.athleteName, cpf: responseToDelete.cpf, phone: responseToDelete.phone, gender: responseToDelete.gender, orders: jerseyOrdersToDelete },
        newValue: null,
      });
    }
    await storage.deleteResponse(Number(req.params.id));
    res.json({ success: true });
  });

  // ===== JERSEY ORDERS =====
  app.get("/api/forms/:formId/jersey-orders", requireAuth, async (req, res) => {
    const ordersList = await storage.getJerseyOrdersByFormId(Number(req.params.formId));
    res.json(ordersList);
  });

  app.get("/api/responses/:responseId/jersey-orders", requireAuth, async (req, res) => {
    const ordersList = await storage.getJerseyOrdersByResponseId(Number(req.params.responseId));
    res.json(ordersList);
  });

  // ===== PAYMENT ORDERS =====
  app.get("/api/forms/:formId/payment-orders", requireAuth, async (req, res) => {
    const ordersList = await storage.getOrdersByFormId(Number(req.params.formId));
    res.json(ordersList);
  });

  app.get("/api/orders/lookup", async (req, res) => {
    const { cpf, phone } = req.query;
    if (!cpf || !phone) return res.status(400).json({ message: "CPF e telefone são obrigatórios" });
    const normalizedCpf = (cpf as string).replace(/\D/g, "");
    const normalizedPhone = (phone as string).replace(/\D/g, "");
    const ordersList = await storage.getOrderByCpfPhone(normalizedCpf, normalizedPhone);
    res.json(ordersList);
  });

  app.get("/api/forms/:formId/orders/lookup-cpf-phone", async (req, res) => {
    const { cpf, phone } = req.query;
    if (!cpf || !phone) return res.status(400).json({ message: "CPF e telefone são obrigatórios" });
    const normalizedCpf = (cpf as string).replace(/\D/g, "");
    const normalizedPhone = (phone as string).replace(/\D/g, "");
    const formId = Number(req.params.formId);
    const ordersList = await storage.getOrdersByFormId(formId);
    const filtered = ordersList
      .filter(o => o.cpf === normalizedCpf && o.phone === normalizedPhone)
      .sort((a, b) => {
        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return db - da;
      })
      .map(o => ({
        id: o.id,
        totalAmount: o.totalAmount,
        paymentStatus: o.paymentStatus,
        asaasPaymentUrl: o.asaasPaymentUrl,
        createdAt: o.createdAt,
        customerName: o.customerName,
      }));
    res.json(filtered);
  });

  app.get("/api/forms/:formId/orders/lookup-cpf", async (req, res) => {
    const { cpf } = req.query;
    if (!cpf) return res.status(400).json({ message: "CPF é obrigatório" });
    const normalizedCpf = (cpf as string).replace(/\D/g, "");
    const formId = Number(req.params.formId);
    const ordersList = await storage.getOrdersByFormId(formId);
    const cpfOrders = ordersList
      .filter(o => o.cpf === normalizedCpf)
      .map(o => ({
        id: o.id,
        totalAmount: o.totalAmount,
        paidAmount: o.paidAmount,
        paymentStatus: o.paymentStatus,
        asaasPaymentUrl: o.asaasPaymentUrl,
        createdAt: o.createdAt,
      }));
    res.json(cpfOrders);
  });

  app.get("/api/orders/by-cpf", async (req, res) => {
    const { cpf } = req.query;
    if (!cpf) return res.status(400).json({ message: "CPF é obrigatório" });
    const normalizedCpf = (cpf as string).replace(/\D/g, "");
    const ordersList = await storage.getOrdersByCpf(normalizedCpf);
    res.json(ordersList);
  });

  app.get("/api/orders/:id", async (req, res) => {
    const order = await storage.getOrder(Number(req.params.id));
    if (!order) return res.status(404).json({ message: "Pedido não encontrado" });
    res.json(order);
  });

  app.get("/api/orders/:id/detail", async (req, res) => {
    const order = await storage.getOrder(Number(req.params.id));
    if (!order) return res.status(404).json({ message: "Pedido não encontrado" });
    const response = await storage.getResponse(order.responseId);
    const jerseyOrdersList = await storage.getJerseyOrdersByResponseId(order.responseId);
    const jerseyDetails = await Promise.all(
      jerseyOrdersList.map(async (jo) => {
        const jersey = await storage.getJersey(jo.jerseyId);
        return { ...jo, jerseyName: jersey?.name || "Camisa removida", jerseyPrice: jersey?.price || "0", jerseyImageUrl: jersey?.imageUrl || null };
      })
    );
    const form = await storage.getForm(order.formId);
    res.json({ order, response, jerseyOrders: jerseyDetails, form: form ? { teamName: form.teamName, logoUrl: form.logoUrl } : null });
  });

  app.get("/api/admin/all-orders", requireAuth, async (req, res) => {
    const workspaceId = getSessionWorkspace(req);
    const allOrders = workspaceId
      ? await storage.getAllOrdersByWorkspace(workspaceId)
      : await storage.getAllOrders();
    res.json(allOrders);
  });

  app.get("/api/admin/orders/:id", requireAuth, async (req, res) => {
    const order = await storage.getOrder(Number(req.params.id));
    if (!order) return res.status(404).json({ message: "Pedido não encontrado" });
    const response = await storage.getResponse(order.responseId);
    const jerseyOrdersList = await storage.getJerseyOrdersByResponseId(order.responseId);
    const jerseyDetails = await Promise.all(
      jerseyOrdersList.map(async (jo) => {
        const jersey = await storage.getJersey(jo.jerseyId);
        return { ...jo, jerseyName: jersey?.name || "Camisa removida", jerseyPrice: jersey?.price || "0" };
      })
    );
    const paymentRecords = await storage.getOrderPaymentsByOrderId(order.id);
    res.json({ order, response, jerseyOrders: jerseyDetails, paymentRecords });
  });

  app.post("/api/admin/orders/:id/confirm-payment", requireAuth, async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      const order = await storage.getOrder(orderId);
      if (!order) return res.status(404).json({ message: "Pedido não encontrado" });

      if (["PAID", "RECEIVED", "CONFIRMED"].includes(order.paymentStatus)) {
        return res.status(400).json({ message: "Este pedido já está pago." });
      }

      const adminEmail = req.session?.adminEmail || "admin";
      const totalAmount = parseFloat(order.totalAmount) || 0;

      const paymentRecord = await storage.createOrderPayment({
        orderId,
        asaasPaymentId: null,
        amount: totalAmount.toFixed(2),
        status: "CONFIRMED_MANUAL",
        confirmedByAdmin: true,
        confirmedAt: new Date(),
        confirmedByEmail: adminEmail,
      });

      const jerseyOrdersList = await storage.getJerseyOrdersByResponseId(order.responseId);
      for (const jo of jerseyOrdersList) {
        if (!jo.paid) {
          await storage.updateJerseyOrder(jo.id, {
            paid: true,
            paidAt: new Date(),
            paymentId: `manual-${paymentRecord.id}`,
          } as any);
        }
      }

      await storage.updateOrder(orderId, {
        paymentStatus: "PAID",
        paidAmount: totalAmount.toFixed(2),
      });

      await storage.createAuditLog({
        responseId: order.responseId,
        action: "PAYMENT_CONFIRMED",
        changedBy: adminEmail,
        oldValue: { paymentStatus: order.paymentStatus, paidAmount: order.paidAmount },
        newValue: { paymentStatus: "PAID", paidAmount: totalAmount.toFixed(2), message: "Admin confirmou pagamento manualmente" },
      });

      res.json({ success: true, paymentRecord });
    } catch (e: any) {
      console.error("Confirm payment error:", e.message);
      res.status(500).json({ message: "Erro ao confirmar pagamento" });
    }
  });

  app.post("/api/admin/orders/:id/link-asaas-payment", requireAuth, async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      const { asaasPaymentId } = req.body;
      if (!asaasPaymentId) return res.status(400).json({ message: "ID do pagamento Asaas é obrigatório" });

      const order = await storage.getOrder(orderId);
      if (!order) return res.status(404).json({ message: "Pedido não encontrado" });

      const existingPayments = await storage.getOrderPaymentsByOrderId(orderId);
      const alreadyLinked = existingPayments.some(p => p.asaasPaymentId === asaasPaymentId);
      if (alreadyLinked) {
        return res.status(400).json({ message: "Este pagamento Asaas já está vinculado a este pedido." });
      }

      let asaasPayment: any;
      try {
        asaasPayment = await getPayment(asaasPaymentId);
      } catch (err: any) {
        return res.status(400).json({ message: "Pagamento Asaas não encontrado ou inválido. Verifique o ID." });
      }

      const adminEmail = req.session?.adminEmail || "admin";
      const paymentValue = asaasPayment.value || 0;
      const isPaid = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(asaasPayment.status);

      const paymentRecord = await storage.createOrderPayment({
        orderId,
        asaasPaymentId: asaasPaymentId,
        amount: paymentValue.toFixed(2),
        status: isPaid ? "PAID" : asaasPayment.status || "PENDING",
        confirmedByAdmin: true,
        confirmedAt: new Date(),
        confirmedByEmail: adminEmail,
      });

      if (isPaid) {
        const currentPaid = parseFloat(order.paidAmount) || 0;
        const newPaid = currentPaid + paymentValue;
        const orderTotal = parseFloat(order.totalAmount) || 0;
        const newStatus = newPaid >= orderTotal - 0.01 ? "PAID" : "PAGAMENTO_PARCIAL";

        await storage.updateOrder(orderId, {
          paymentStatus: newStatus,
          paidAmount: newPaid.toFixed(2),
          asaasPaymentId: asaasPaymentId,
          asaasPaymentUrl: asaasPayment.invoiceUrl || asaasPayment.bankSlipUrl || null,
        });

        if (newStatus === "PAID") {
          const jerseyOrdersList = await storage.getJerseyOrdersByResponseId(order.responseId);
          for (const jo of jerseyOrdersList) {
            if (!jo.paid) {
              await storage.updateJerseyOrder(jo.id, {
                paid: true,
                paidAt: new Date(),
                paymentId: asaasPaymentId,
              } as any);
            }
          }
        }
      }

      await storage.createAuditLog({
        responseId: order.responseId,
        action: "ASAAS_PAYMENT_LINKED",
        changedBy: adminEmail,
        oldValue: { asaasPaymentId: order.asaasPaymentId },
        newValue: { asaasPaymentId, amount: paymentValue.toFixed(2), asaasStatus: asaasPayment.status, message: "Admin vinculou pagamento Asaas ao pedido" },
      });

      res.json({ success: true, paymentRecord, asaasPayment: { status: asaasPayment.status, value: paymentValue } });
    } catch (e: any) {
      console.error("Link Asaas payment error:", e.message);
      res.status(500).json({ message: "Erro ao vincular pagamento Asaas" });
    }
  });

  app.get("/api/admin/orders/:id/payments", requireAuth, async (req, res) => {
    const orderId = Number(req.params.id);
    const payments = await storage.getOrderPaymentsByOrderId(orderId);
    res.json(payments);
  });

  // ===== NUMBER AVAILABILITY =====
  app.get("/api/forms/:formId/numbers", async (req, res) => {
    const takenNumbers = await storage.getTakenNumbers(Number(req.params.formId));
    res.json(takenNumbers);
  });

  app.post("/api/forms/:formId/check-number", async (req, res) => {
    const { number, gender, excludeResponseId } = req.body;
    if (!number) return res.status(400).json({ message: "Número é obrigatório" });
    const formId = Number(req.params.formId);
    const takenNumbers = await storage.getTakenNumbers(formId);
    const checkGender = gender || "male";
    const conflict = takenNumbers.find(
      t => t.number === number && t.gender === checkGender && (!excludeResponseId || t.responseId !== excludeResponseId)
    );
    if (conflict) {
      res.json({ available: false, takenBy: conflict.athleteName });
    } else {
      res.json({ available: true });
    }
  });

  app.post("/api/forms/:formId/check-number-jersey", async (req, res) => {
    const { number, jerseyId, gender, excludeResponseId } = req.body;
    if (!number) return res.status(400).json({ message: "Número é obrigatório" });
    if (!jerseyId) return res.status(400).json({ message: "ID da camiseta é obrigatório" });
    const formId = Number(req.params.formId);
    const takenNumbers = await storage.getTakenNumbers(formId);
    const checkGender = gender || "male";
    const conflict = takenNumbers.find(
      t => t.number === number && t.jerseyId === jerseyId && t.gender === checkGender && (!excludeResponseId || t.responseId !== excludeResponseId)
    );
    if (conflict) {
      res.json({ available: false, takenBy: conflict.athleteName });
    } else {
      res.json({ available: true });
    }
  });

  // ===== NUMBER RESERVATIONS =====
  app.get("/api/forms/:formId/reservations", async (req, res) => {
    try {
      const formId = Number(req.params.formId);
      const reservations = await storage.getReservationsForForm(formId);
      res.json(reservations);
    } catch (e: any) {
      res.status(500).json({ message: "Erro ao buscar reservas" });
    }
  });

  app.post("/api/reservations", async (req, res) => {
    try {
      const { jerseyId, number, gender, reservedBy, reservedByName } = req.body;
      if (!jerseyId || !number || !reservedBy || !reservedByName) {
        return res.status(400).json({ message: "Dados incompletos para reserva" });
      }
      const jersey = await storage.getJersey(jerseyId);
      const formId = jersey?.formId;
      if (!formId) return res.status(404).json({ message: "Camiseta não encontrada" });

      const takenNumbers = await storage.getTakenNumbers(formId);
      const reqGender = gender || "male";
      const conflict = takenNumbers.find(t => t.number === number && t.jerseyId === jerseyId && t.gender === reqGender);
      if (conflict) {
        return res.status(409).json({ message: `Número ${number} já escolhido por ${conflict.athleteName}.` });
      }

      const existingReservations = await storage.getReservationsForJersey(jerseyId);
      const reservedByOther = existingReservations.find(r => r.number === number && r.gender === reqGender && r.reservedBy !== reservedBy);
      if (reservedByOther) {
        return res.status(409).json({ message: `Este número está reservado temporariamente por ${reservedByOther.reservedByName}.` });
      }

      const form = await storage.getForm(formId);
      let reservationMs = 5 * 60 * 1000;
      if (form) {
        const val = form.reservationTimeValue || 5;
        const unit = form.reservationTimeUnit || "minutes";
        const multiplier = unit === "seconds" ? 1000 : unit === "hours" ? 3600000 : 60000;
        reservationMs = val * multiplier;
      }
      const expiresAt = new Date(Date.now() + reservationMs);
      const reservation = await storage.createReservation({ jerseyId, number, gender: gender || "male", reservedBy, reservedByName, expiresAt });

      broadcast(formId, { type: "number_reserved", jerseyId, number, gender: gender || "male", reservedByName, expiresAt: expiresAt.toISOString() });

      res.json(reservation);
    } catch (e: any) {
      res.status(500).json({ message: "Erro ao criar reserva. Tente novamente." });
    }
  });

  app.delete("/api/reservations/:jerseyId/:number", async (req, res) => {
    try {
      const jerseyId = Number(req.params.jerseyId);
      const number = req.params.number;
      const jersey = await storage.getJersey(jerseyId);
      if (!jersey) return res.status(404).json({ message: "Camiseta não encontrada" });

      const gender = req.query.gender as string || "male";
      await storage.deleteReservation(jerseyId, number, gender);
      broadcast(jersey.formId, { type: "number_released_by_user", jerseyId, number, gender });
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ message: "Erro ao liberar reserva" });
    }
  });

  // ===== ORDER CANCELLATION BY CUSTOMER =====
  app.delete("/api/orders/:id/cancel-by-customer", async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      const { cpf } = req.body;
      if (!cpf) return res.status(400).json({ message: "CPF é obrigatório para cancelar o pedido." });

      const normalizedCpf = cpf.replace(/\D/g, "");
      const order = await storage.getOrder(orderId);
      if (!order) return res.status(404).json({ message: "Pedido não encontrado." });
      if (order.cpf !== normalizedCpf) {
        return res.status(403).json({ message: "Você não tem permissão para cancelar este pedido." });
      }
      if (["PAID", "RECEIVED", "CONFIRMED", "PAGAMENTO_PARCIAL"].includes(order.paymentStatus)) {
        return res.status(400).json({ message: "Não é possível cancelar um pedido com pagamento já realizado." });
      }
      if (order.paymentStatus === "CANCELLED") {
        return res.status(400).json({ message: "Este pedido já foi cancelado." });
      }

      const response = await storage.getResponse(order.responseId);
      if (response) {
        const jerseyOrdersList = await storage.getJerseyOrdersByResponseId(response.id);
        await storage.createAuditLog({
          responseId: response.id,
          action: "CANCELLED_BY_CUSTOMER",
          changedBy: "cliente",
          oldValue: { athleteName: response.athleteName, cpf: response.cpf, orders: jerseyOrdersList },
          newValue: null,
        });
      }

      const jerseyOrdersToRelease = await storage.getJerseyOrdersByResponseId(order.responseId);
      await storage.deleteJerseyOrdersByResponseId(order.responseId);
      await storage.updateOrder(orderId, { paymentStatus: "CANCELLED" });

      if (response) {
        await storage.deleteResponse(response.id);
      }

      for (const jo of jerseyOrdersToRelease) {
        broadcast(order.formId, { type: "number_released_by_user", jerseyId: jo.jerseyId, number: jo.number, gender: jo.gender || "male" });
        if (jo.extraNumbers) {
          for (const extra of jo.extraNumbers) {
            broadcast(order.formId, { type: "number_released_by_user", jerseyId: jo.jerseyId, number: extra.number, gender: jo.gender || "male" });
          }
        }
      }
      res.json({ success: true, message: "Pedido cancelado com sucesso." });
    } catch (e: any) {
      console.error("Cancel order error:", e.message);
      res.status(500).json({ message: "Erro ao cancelar pedido. Tente novamente." });
    }
  });

  // ===== NUMBER SELECTIONS (admin) =====
  app.get("/api/forms/:formId/number-selections", requireAuth, async (req, res) => {
    try {
      const selections = await storage.getNumberSelectionsForForm(Number(req.params.formId));
      res.json(selections);
    } catch (e: any) {
      res.status(500).json({ message: "Erro ao buscar seleções de números" });
    }
  });

  // ===== ADMIN NUMBER RELEASE =====
  app.delete("/api/admin/release-number/:jerseyId/:gender/:number", requireAuth, async (req, res) => {
    try {
      const jerseyId = Number(req.params.jerseyId);
      const number = req.params.number;
      const gender = req.params.gender;
      const jersey = await storage.getJersey(jerseyId);
      if (!jersey) return res.status(404).json({ message: "Camiseta não encontrada" });

      const takenNumbers = await storage.getTakenNumbers(jersey.formId);
      const taken = takenNumbers.find(t => t.number === number && t.jerseyId === jerseyId && t.gender === gender);

      if (taken) {
        const response = await storage.getResponse(taken.responseId);
        const ordersList = await storage.getOrdersByResponseId(taken.responseId);

        await storage.createAuditLog({
          responseId: taken.responseId,
          action: "CANCELLED_BY_ADMIN",
          changedBy: "admin",
          oldValue: {
            athleteName: taken.athleteName,
            number,
            jerseyName: jersey.name,
            jerseyId,
          },
          newValue: {
            reason: `Admin liberou número ${number} da Camiseta ${jersey.name}`,
          },
        });

        await storage.deleteJerseyOrdersByResponseId(taken.responseId);
        for (const ord of ordersList) {
          await storage.updateOrder(ord.id, { paymentStatus: "CANCELLED_BY_ADMIN" });
        }
        if (response) {
          await storage.deleteResponse(response.id);
        }
      }

      await storage.deleteReservation(jerseyId, number, gender);
      broadcast(jersey.formId, { type: "number_released_by_admin", jerseyId, number, gender });
      res.json({ success: true, message: `Número ${number} liberado com sucesso.` });
    } catch (e: any) {
      console.error("Admin release number error:", e.message);
      res.status(500).json({ message: "Erro ao liberar número" });
    }
  });

  // ===== ADMIN GENDER CHANGE =====
  app.patch("/api/admin/responses/:id/gender", requireAuth, async (req, res) => {
    try {
      const responseId = Number(req.params.id);
      const { gender } = req.body;
      if (!gender || !["male", "female"].includes(gender)) {
        return res.status(400).json({ message: "Gênero inválido. Use 'male' ou 'female'." });
      }

      const response = await storage.getResponse(responseId);
      if (!response) return res.status(404).json({ message: "Resposta não encontrada" });

      if (response.gender === gender) {
        return res.json({ success: true, message: "Gênero já está definido como solicitado." });
      }

      const oldGender = response.gender;
      const jerseyOrdersList = await storage.getJerseyOrdersByResponseId(responseId);

      for (const jo of jerseyOrdersList) {
        const takenNumbers = await storage.getTakenNumbers(response.formId);
        const conflict = takenNumbers.find(
          t => t.jerseyId === jo.jerseyId && t.number === jo.number && t.gender === gender && t.responseId !== responseId
        );
        if (conflict) {
          const jersey = await storage.getJersey(jo.jerseyId);
          return res.status(409).json({
            message: `Não é possível alterar o gênero porque o número ${jo.number} já está ocupado na camiseta "${jersey?.name || jo.jerseyId}" (${gender === "male" ? "Masculino" : "Feminino"}).`
          });
        }

        if (jo.extraNumbers) {
          for (const extra of jo.extraNumbers) {
            const extraConflict = takenNumbers.find(
              t => t.jerseyId === jo.jerseyId && t.number === extra.number && t.gender === gender && t.responseId !== responseId
            );
            if (extraConflict) {
              const jersey = await storage.getJersey(jo.jerseyId);
              return res.status(409).json({
                message: `Não é possível alterar o gênero porque o número ${extra.number} já está ocupado na camiseta "${jersey?.name || jo.jerseyId}" (${gender === "male" ? "Masculino" : "Feminino"}).`
              });
            }
          }
        }
      }

      await storage.updateResponse(responseId, { gender });

      for (const jo of jerseyOrdersList) {
        await db.update(jerseyOrders).set({ gender }).where(eq(jerseyOrders.id, jo.id));
      }

      const formJerseys = await storage.getJerseysByFormId(response.formId);
      const formJerseyIds = formJerseys.map(j => j.id);
      for (const jId of formJerseyIds) {
        await db.update(numberReservations)
          .set({ gender })
          .where(
            and(
              eq(numberReservations.reservedBy, response.cpf),
              eq(numberReservations.jerseyId, jId)
            )
          );
      }

      await storage.createAuditLog({
        responseId,
        action: "ADMIN_EDIT",
        changedBy: req.session?.adminEmail || "admin",
        oldValue: { gender: oldGender },
        newValue: { gender, reason: `Admin alterou gênero de ${oldGender === "male" ? "Masculino" : "Feminino"} para ${gender === "male" ? "Masculino" : "Feminino"}` },
      });

      for (const jo of jerseyOrdersList) {
        broadcast(response.formId, { type: "number_removed_from_gender", jerseyId: jo.jerseyId, number: jo.number, gender: oldGender });
        broadcast(response.formId, { type: "number_added_to_gender", jerseyId: jo.jerseyId, number: jo.number, gender });
        if (jo.extraNumbers) {
          for (const extra of jo.extraNumbers) {
            broadcast(response.formId, { type: "number_removed_from_gender", jerseyId: jo.jerseyId, number: extra.number, gender: oldGender });
            broadcast(response.formId, { type: "number_added_to_gender", jerseyId: jo.jerseyId, number: extra.number, gender });
          }
        }
      }

      res.json({ success: true, message: `Gênero alterado com sucesso de ${oldGender === "male" ? "Masculino" : "Feminino"} para ${gender === "male" ? "Masculino" : "Feminino"}.` });
    } catch (e: any) {
      console.error("Admin gender change error:", e.message);
      res.status(500).json({ message: "Erro ao alterar gênero" });
    }
  });

  // ===== AUDIT LOG =====
  app.get("/api/admin/responses/:id/audit-log", requireAuth, async (req, res) => {
    const responseId = Number(req.params.id);
    const logs = await storage.getAuditLogsByResponseId(responseId);
    res.json(logs);
  });

  // ===== ASAAS WEBHOOK =====
  app.post("/api/webhooks/asaas", async (req, res) => {
    try {
      const { event, payment } = req.body;
      if (!payment?.id) return res.status(400).json({ message: "Webhook inválido" });

      const allOrders = await storage.getAllOrders();
      const order = allOrders.find(o => {
        if (o.asaasPaymentId === payment.id) return true;
        const history = o.asaasPaymentHistory as Array<{ paymentId: string }> | null;
        if (history && history.some(h => h.paymentId === payment.id)) return true;
        return false;
      });
      if (!order) return res.status(404).json({ message: "Pedido não encontrado" });

      const paymentValue = payment.value || 0;
      const history = (order.asaasPaymentHistory || []) as Array<{ paymentId: string; value: number; url: string | null; creditedAt: string | null }>;

      switch (event) {
        case "PAYMENT_RECEIVED":
        case "PAYMENT_CONFIRMED": {
          const existingEntry = history.find(h => h.paymentId === payment.id);
          if (existingEntry && existingEntry.creditedAt) {
            return res.json({ success: true, message: "Pagamento já processado" });
          }

          const newHistory = history.map(h =>
            h.paymentId === payment.id
              ? { ...h, creditedAt: new Date().toISOString() }
              : h
          );
          if (!newHistory.some(h => h.paymentId === payment.id)) {
            newHistory.push({ paymentId: payment.id, value: paymentValue, url: payment.invoiceUrl || payment.bankSlipUrl || null, creditedAt: new Date().toISOString() });
          }

          const totalCredited = newHistory.reduce((sum, h) => sum + (h.creditedAt ? h.value : 0), 0);
          const orderTotal = parseFloat(order.totalAmount) || 0;
          const newStatus = totalCredited >= orderTotal - 0.01 ? "PAID" : "PAGAMENTO_PARCIAL";

          await storage.updateOrder(order.id, {
            paymentStatus: newStatus,
            paidAmount: totalCredited.toFixed(2),
            asaasPaymentHistory: newHistory as any,
          });

          if (newStatus === "PAID") {
            const jerseyOrdersList = await storage.getJerseyOrdersByResponseId(order.responseId);
            for (const jo of jerseyOrdersList) {
              if (!jo.paid) {
                await storage.updateJerseyOrder(jo.id, {
                  paid: true,
                  paidAt: new Date(),
                  paymentId: payment.id,
                } as any);
              }
            }
          }
          break;
        }
        case "PAYMENT_OVERDUE":
          if (!["PAID", "PAGAMENTO_PARCIAL"].includes(order.paymentStatus)) {
            await storage.updateOrder(order.id, { paymentStatus: "OVERDUE" });
          }
          break;
        case "PAYMENT_DELETED":
        case "PAYMENT_REFUNDED":
        case "PAYMENT_RESTORED":
          if (!["PAID"].includes(order.paymentStatus)) {
            await storage.updateOrder(order.id, { paymentStatus: "CANCELLED" });
          }
          break;
        case "PAYMENT_CREATED":
        case "PAYMENT_UPDATED":
          if (!["PAID", "PAGAMENTO_PARCIAL"].includes(order.paymentStatus)) {
            await storage.updateOrder(order.id, { paymentStatus: "AWAITING_PAYMENT" });
          }
          break;
      }

      res.json({ success: true });
    } catch (e: any) {
      console.error("Webhook error:", e.message);
      res.status(500).json({ message: "Erro ao processar webhook" });
    }
  });

  // ===== EXPORT =====
  app.get("/api/forms/:formId/export", requireAuth, async (req, res) => {
    const formId = Number(req.params.formId);
    const form = await storage.getForm(formId);
    if (!form) return res.status(404).json({ message: "Formulário não encontrado" });
    
    const responsesList = await storage.getResponsesByFormId(formId);
    const jerseyList = await storage.getJerseysByFormId(formId);
    const allJerseyOrders = await storage.getJerseyOrdersByFormId(formId);
    
    const jerseyMap = new Map(jerseyList.map(j => [j.id, j]));
    const responseMap = new Map(responsesList.map(r => [r.id, r]));
    
    const expandedList: Array<{
      playerName: string;
      jerseyModel: string;
      number: string;
      size: string;
      nickname: string;
      price: string;
    }> = [];

    for (const order of allJerseyOrders) {
      const jersey = jerseyMap.get(order.jerseyId);
      const response = responseMap.get(order.responseId);
      const price = jersey?.price || "0";
      expandedList.push({
        playerName: response?.athleteName || "Unknown",
        jerseyModel: jersey?.name || "Unknown",
        number: order.number,
        size: order.size,
        nickname: order.nickname,
        price,
      });
      if (order.extraNumbers) {
        for (const extra of order.extraNumbers) {
          expandedList.push({
            playerName: response?.athleteName || "Unknown",
            jerseyModel: jersey?.name || "Unknown",
            number: extra.number,
            size: (extra as any).size || order.size,
            nickname: extra.nickname,
            price,
          });
        }
      }
    }

    if (req.query.format === "csv") {
      const headers = "Atleta,Modelo da Camisa,Número,Tamanho,Apelido,Valor\n";
      const rows = expandedList.map(p => 
        `"${p.playerName}","${p.jerseyModel}","${p.number}","${p.size}","${p.nickname}","R$ ${p.price}"`
      ).join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${form.teamName}-producao.csv"`);
      return res.send(headers + rows);
    }

    if (req.query.format === "pdf") {
      try {
        const PDFDocument = (await import("pdfkit")).default;
        const doc = new PDFDocument({ margin: 40, size: "A4" });
        
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="${form.teamName}-relatorio.pdf"`);
        doc.pipe(res);

        doc.fontSize(20).fillColor("#0F172A").text("Relatório de Pedidos de Uniforme", { align: "center" });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor("#64748B").text(`Nome do time: ${form.teamName}`, { align: "center" });
        doc.text(`Data de geração: ${new Date().toLocaleDateString("pt-BR")}`, { align: "center" });
        doc.text(`Total de atletas: ${responsesList.length}`, { align: "center" });
        doc.text(`Total de camisetas: ${expandedList.length}`, { align: "center" });
        doc.moveDown(1.5);

        const tableTop = doc.y;
        const colWidths = [90, 90, 50, 55, 80, 55];
        const colHeaders = ["Atleta", "Modelo", "Número", "Tamanho", "Apelido", "Valor"];
        const tableLeft = 40;

        doc.fontSize(8).fillColor("#FFFFFF");
        let x = tableLeft;
        for (let i = 0; i < colHeaders.length; i++) {
          doc.rect(x, tableTop, colWidths[i], 20).fill("#2563EB");
          doc.fillColor("#FFFFFF").text(colHeaders[i], x + 4, tableTop + 6, { width: colWidths[i] - 8, align: "left" });
          x += colWidths[i];
        }

        let y = tableTop + 20;
        let totalValue = 0;
        doc.fillColor("#0F172A");
        
        for (let ri = 0; ri < expandedList.length; ri++) {
          const row = expandedList[ri];
          if (y > 750) {
            doc.addPage();
            y = 40;
          }
          const bgColor = ri % 2 === 0 ? "#F8FAFC" : "#FFFFFF";
          x = tableLeft;
          const rowData = [row.playerName, row.jerseyModel, row.number, row.size, row.nickname, `R$ ${row.price}`];
          for (let i = 0; i < rowData.length; i++) {
            doc.rect(x, y, colWidths[i], 18).fill(bgColor).stroke("#E2E8F0");
            doc.fillColor("#0F172A").fontSize(7).text(rowData[i], x + 4, y + 5, { width: colWidths[i] - 8, align: "left" });
            x += colWidths[i];
          }
          totalValue += parseFloat(row.price) || 0;
          y += 18;
        }

        y += 20;
        if (y > 700) { doc.addPage(); y = 40; }
        doc.fontSize(14).fillColor("#0F172A").text("Resumo Financeiro", tableLeft, y);
        y += 25;
        doc.fontSize(10).fillColor("#334155");
        doc.text(`Total de camisetas: ${expandedList.length}`, tableLeft, y);
        y += 18;
        doc.text(`Total arrecadado: R$ ${totalValue.toFixed(2).replace(".", ",")}`, tableLeft, y);

        doc.end();
        return;
      } catch (pdfErr: any) {
        return res.status(500).json({ message: "Erro ao gerar PDF: " + pdfErr.message });
      }
    }

    res.json({ form, responses: responsesList, jerseys: jerseyList, orders: allJerseyOrders, expandedList });
  });

  // ===== FINANCIAL REPORT =====
  app.get("/api/admin/financial-report/export", requireAuth, async (req, res) => {
    const allPaymentOrders = await storage.getAllOrders();
    const allResponses: Array<{ id: number; athleteName: string }> = [];
    const formIds = [...new Set(allPaymentOrders.map(o => o.formId))];
    for (const fId of formIds) {
      const resps = await storage.getResponsesByFormId(fId);
      allResponses.push(...resps.map(r => ({ id: r.id, athleteName: r.athleteName })));
    }
    const responseMap = new Map(allResponses.map(r => [r.id, r.athleteName]));

    const reportRows = allPaymentOrders.map(o => ({
      athlete: responseMap.get(o.responseId) || o.customerName,
      orderId: o.id,
      amount: o.totalAmount,
      status: o.paymentStatus,
      date: o.createdAt ? new Date(o.createdAt).toLocaleDateString("pt-BR") : "",
    }));

    const statusLabels: Record<string, string> = {
      PENDING: "Pendente",
      AWAITING_PAYMENT: "Aguardando Pagamento",
      PAID: "Pago",
      OVERDUE: "Vencido",
      CANCELLED: "Cancelado",
    };

    if (req.query.format === "csv") {
      const headers = "Atleta,Pedido,Valor,Status,Data\n";
      const rows = reportRows.map(r =>
        `"${r.athlete}","#${r.orderId}","R$ ${r.amount}","${statusLabels[r.status] || r.status}","${r.date}"`
      ).join("\n");
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="relatorio-financeiro.csv"`);
      return res.send(headers + rows);
    }

    if (req.query.format === "pdf") {
      try {
        const PDFDocument = (await import("pdfkit")).default;
        const doc = new PDFDocument({ margin: 40, size: "A4" });
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="relatorio-financeiro.pdf"`);
        doc.pipe(res);

        doc.fontSize(20).fillColor("#0F172A").text("Relatório de Pagamentos", { align: "center" });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor("#64748B").text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, { align: "center" });
        doc.moveDown(1.5);

        const colWidths = [110, 60, 80, 100, 80];
        const colHeaders = ["Atleta", "Pedido", "Valor", "Status", "Data"];
        const tableLeft = 40;
        const tableTop = doc.y;

        let x = tableLeft;
        for (let i = 0; i < colHeaders.length; i++) {
          doc.rect(x, tableTop, colWidths[i], 20).fill("#2563EB");
          doc.fillColor("#FFFFFF").fontSize(8).text(colHeaders[i], x + 4, tableTop + 6, { width: colWidths[i] - 8 });
          x += colWidths[i];
        }

        let y = tableTop + 20;
        let totalPaid = 0;
        for (let ri = 0; ri < reportRows.length; ri++) {
          const r = reportRows[ri];
          if (y > 750) { doc.addPage(); y = 40; }
          const bg = ri % 2 === 0 ? "#F8FAFC" : "#FFFFFF";
          x = tableLeft;
          const rowData = [r.athlete, `#${r.orderId}`, `R$ ${r.amount}`, statusLabels[r.status] || r.status, r.date];
          for (let i = 0; i < rowData.length; i++) {
            doc.rect(x, y, colWidths[i], 18).fill(bg).stroke("#E2E8F0");
            doc.fillColor("#0F172A").fontSize(7).text(rowData[i], x + 4, y + 5, { width: colWidths[i] - 8 });
            x += colWidths[i];
          }
          if (r.status === "PAID") totalPaid += parseFloat(r.amount) || 0;
          y += 18;
        }

        y += 20;
        doc.fontSize(12).fillColor("#0F172A").text("Resumo", tableLeft, y);
        y += 20;
        doc.fontSize(10).fillColor("#334155");
        doc.text(`Total de pedidos: ${reportRows.length}`, tableLeft, y);
        y += 16;
        doc.text(`Total pago: R$ ${totalPaid.toFixed(2).replace(".", ",")}`, tableLeft, y);

        doc.end();
        return;
      } catch (err: any) {
        return res.status(500).json({ message: err.message });
      }
    }

    res.json(reportRows);
  });

  // ===== CUSTOMERS =====
  app.get("/api/customers", requireAuth, async (req, res) => {
    const workspaceId = getSessionWorkspace(req);
    const allCustomers = workspaceId
      ? await storage.getCustomersByWorkspace(workspaceId)
      : await storage.getAllCustomers();
    res.json(allCustomers);
  });

  app.get("/api/customers/lookup-cpf", async (req, res) => {
    const { cpf } = req.query;
    if (!cpf) return res.status(400).json({ message: "CPF é obrigatório" });
    const normalizedCpf = (cpf as string).replace(/\D/g, "");
    const customer = await storage.getCustomerByCpf(normalizedCpf);
    if (!customer) return res.status(404).json({ message: "Cliente não encontrado" });
    res.json({ id: customer.id, name: customer.name, cpf: customer.cpf, phone: customer.phone });
  });

  app.get("/api/customers/:id", requireAuth, async (req, res) => {
    const customer = await storage.getCustomer(Number(req.params.id));
    if (!customer) return res.status(404).json({ message: "Cliente não encontrado" });
    res.json(customer);
  });

  app.post("/api/customers", requireAuth, async (req, res) => {
    try {
      const { name, cpf, phone } = req.body;
      if (!name || !cpf || !phone) {
        return res.status(400).json({ message: "Nome, CPF e telefone são obrigatórios" });
      }
      const normalizedCpf = cpf.replace(/\D/g, "");
      const existing = await storage.getCustomerByCpf(normalizedCpf);
      if (existing) {
        return res.status(409).json({ message: "Já existe um cliente com esse CPF" });
      }
      const notes = req.body.notes || null;
      const workspaceId = getSessionWorkspace(req);
      const customer = await storage.createCustomer({ name: (name || "").toUpperCase(), cpf: normalizedCpf, phone: phone.replace(/\D/g, ""), notes, workspaceId: workspaceId || null });
      await storage.createCustomerAuditLog({
        customerId: customer.id,
        action: "CREATED",
        changedBy: req.session?.adminEmail || "admin",
        oldValue: null,
        newValue: { name: customer.name, cpf: customer.cpf, phone: customer.phone, ...(notes ? { notes } : {}) },
      });
      res.json(customer);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/customers/:id", requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const existing = await storage.getCustomer(id);
      if (!existing) return res.status(404).json({ message: "Cliente não encontrado" });
      const { name, phone, notes } = req.body;
      const updateData: any = {};
      if (name) updateData.name = (name || "").toUpperCase();
      if (phone) updateData.phone = phone.replace(/\D/g, "");
      if (notes !== undefined) updateData.notes = notes || null;
      const oldValue: Record<string, string> = {};
      const newValue: Record<string, string> = {};
      if (name && name !== existing.name) {
        oldValue.name = existing.name;
        newValue.name = name;
      }
      if (phone && phone.replace(/\D/g, "") !== existing.phone) {
        oldValue.phone = existing.phone;
        newValue.phone = phone.replace(/\D/g, "");
      }
      if (notes !== undefined && notes !== existing.notes) {
        oldValue.notes = existing.notes || "";
        newValue.notes = notes || "";
      }
      const updated = await storage.updateCustomer(id, updateData);
      if (Object.keys(newValue).length > 0) {
        await storage.createCustomerAuditLog({
          customerId: id,
          action: "ADMIN_EDIT",
          changedBy: req.session?.adminEmail || "admin",
          oldValue,
          newValue,
        });
      }
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.get("/api/customers/:id/orders", requireAuth, async (req, res) => {
    const customer = await storage.getCustomer(Number(req.params.id));
    if (!customer) return res.status(404).json({ message: "Cliente não encontrado" });
    const ordersList = await storage.getOrdersByCpf(customer.cpf);
    res.json(ordersList);
  });

  app.get("/api/customers/:id/audit-log", requireAuth, async (req, res) => {
    const logs = await storage.getCustomerAuditLogs(Number(req.params.id));
    res.json(logs);
  });

  // ===== VIRTUAL TRY-ON =====
  const tryonUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024, fieldSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (["image/jpeg", "image/png"].includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error("Apenas arquivos JPG/PNG são permitidos"));
      }
    },
  });

  app.post("/api/tryon", tryonUpload.fields([
    { name: "personImage", maxCount: 1 },
  ]), async (req: Request, res: Response) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
      const personFile = files?.personImage?.[0];

      if (!personFile) {
        return res.status(400).json({ message: "Foto da pessoa é obrigatória" });
      }

      let jerseyDataUrl: string;
      if (req.body.jerseyImageUrl) {
        jerseyDataUrl = req.body.jerseyImageUrl;
      } else {
        return res.status(400).json({ message: "Imagem do uniforme é obrigatória" });
      }

      const personDataUrl = fileToDataUrl(personFile);

      const apiToken = process.env.REPLICATE_API_TOKEN;
      if (!apiToken) {
        return res.status(500).json({ message: "Serviço de Try-On não configurado" });
      }

      const Replicate = (await import("replicate")).default;
      const replicate = new Replicate({ auth: apiToken });

      const TIMEOUT_MS = 2 * 60 * 1000;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Tempo limite excedido para gerar a visualização")), TIMEOUT_MS)
      );

      const predictionPromise = replicate.run(
        "cuuupid/idm-vton:0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985",
        {
          input: {
            human_img: personDataUrl,
            garm_img: jerseyDataUrl,
            category: "upper_body",
          },
        }
      );

      const output = await Promise.race([predictionPromise, timeoutPromise]);

      let resultUrl: string | null = null;
      if (typeof output === "string") {
        resultUrl = output;
      } else if (Array.isArray(output) && output.length > 0) {
        resultUrl = String(output[0]);
      } else if (output && typeof output === "object") {
        const outputObj = output as Record<string, unknown>;
        if (typeof outputObj.url === "string") {
          resultUrl = outputObj.url;
        } else if (typeof outputObj.output === "string") {
          resultUrl = outputObj.output;
        }
      }

      if (!resultUrl) {
        return res.status(500).json({ message: "Não foi possível gerar a visualização. Tente novamente." });
      }

      res.json({ resultUrl });
    } catch (e: any) {
      console.error("Try-on error:", e.message);
      if (e.message?.includes("Tempo limite")) {
        return res.status(504).json({ message: e.message });
      }
      res.status(500).json({ message: "Erro ao gerar visualização: " + (e.message || "Erro desconhecido") });
    }
  });

  // ===== SUB-ADMINS & WORKSPACES (apenas admin principal) =====

  // Listar todos os sub-admins
  app.get("/api/admin/sub-admins", requireSuperAdmin, async (_req, res) => {
    try {
      const list = await storage.getAllSubAdmins();
      const workspacesList = await storage.getAllWorkspaces();
      const result = list.map(sa => {
        const ws = workspacesList.find(w => w.id === sa.workspaceId);
        return {
          id: sa.id,
          name: sa.name,
          email: sa.email,
          isActive: sa.isActive,
          workspaceId: sa.workspaceId,
          workspaceName: ws?.name || "Workspace",
          createdAt: sa.createdAt,
          permissions: {
            canManageForms: sa.canManageForms,
            canManageCustomers: sa.canManageCustomers,
            canViewReports: sa.canViewReports,
            canManagePayments: sa.canManagePayments,
            canConfigureAsaas: sa.canConfigureAsaas,
          }
        };
      });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Criar novo sub-admin
  app.post("/api/admin/sub-admins", requireSuperAdmin, async (req, res) => {
    try {
      const { name, email, password, workspaceName, permissions } = req.body;
      if (!name || !email || !password || !workspaceName) {
        return res.status(400).json({ message: "Nome, email, senha e nome do workspace são obrigatórios" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "A senha deve ter pelo menos 6 caracteres" });
      }
      // Verifica se email já existe
      const existingAdmin = await storage.getAdminByEmail(email);
      const existingSubAdmin = await storage.getSubAdminByEmail(email);
      if (existingAdmin || existingSubAdmin) {
        return res.status(409).json({ message: "Já existe um usuário com esse email" });
      }
      // Cria workspace
      const workspace = await storage.createWorkspace({ name: workspaceName });
      // Cria sub-admin
      const passwordHash = await bcrypt.hash(password, 10);
      const subAdmin = await storage.createSubAdmin({
        workspaceId: workspace.id,
        name,
        email,
        passwordHash,
        canManageForms: permissions?.canManageForms !== false,
        canManageCustomers: permissions?.canManageCustomers !== false,
        canViewReports: permissions?.canViewReports !== false,
        canManagePayments: permissions?.canManagePayments !== false,
        canConfigureAsaas: permissions?.canConfigureAsaas !== false,
        isActive: true,
      });
      res.json({
        id: subAdmin.id,
        name: subAdmin.name,
        email: subAdmin.email,
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        isActive: subAdmin.isActive,
        permissions: {
          canManageForms: subAdmin.canManageForms,
          canManageCustomers: subAdmin.canManageCustomers,
          canViewReports: subAdmin.canViewReports,
          canManagePayments: subAdmin.canManagePayments,
          canConfigureAsaas: subAdmin.canConfigureAsaas,
        }
      });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Atualizar sub-admin (permissões, senha, status)
  app.patch("/api/admin/sub-admins/:id", requireSuperAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { name, password, isActive, permissions } = req.body;
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (password) {
        if (password.length < 6) return res.status(400).json({ message: "A senha deve ter pelo menos 6 caracteres" });
        updateData.passwordHash = await bcrypt.hash(password, 10);
      }
      if (permissions) {
        if (permissions.canManageForms !== undefined) updateData.canManageForms = permissions.canManageForms;
        if (permissions.canManageCustomers !== undefined) updateData.canManageCustomers = permissions.canManageCustomers;
        if (permissions.canViewReports !== undefined) updateData.canViewReports = permissions.canViewReports;
        if (permissions.canManagePayments !== undefined) updateData.canManagePayments = permissions.canManagePayments;
        if (permissions.canConfigureAsaas !== undefined) updateData.canConfigureAsaas = permissions.canConfigureAsaas;
      }
      const updated = await storage.updateSubAdmin(id, updateData);
      if (!updated) return res.status(404).json({ message: "Sub-admin não encontrado" });
      res.json({ success: true, id: updated.id, isActive: updated.isActive });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

    // Deletar sub-admin
  app.delete("/api/admin/sub-admins/:id", requireSuperAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const subAdmin = await storage.getSubAdmin(id);
      if (!subAdmin) return res.status(404).json({ message: "Sub-admin não encontrado" });
      await storage.deleteSubAdmin(id);
      await storage.deleteWorkspace(subAdmin.workspaceId);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // ===== PLANOS DE ASSINATURA PIX AUTOMÁTICO =====

  // Listar planos
  app.get("/api/admin/subscription-plans", requireAuth, async (req, res) => {
    try {
      const workspaceId = getSessionWorkspace(req);
      const plans = await storage.getAllSubscriptionPlans(workspaceId);
      // Para cada plano, conta assinantes ativos
      const result = await Promise.all(plans.map(async (plan) => {
        const subs = await storage.getSubscriptionsByPlanId(plan.id);
        return {
          ...plan,
          subscriberCount: subs.filter(s => s.status === 'ACTIVE').length,
          totalSubscribers: subs.length,
          publicUrl: `/assinar/${plan.shareId}`,
        };
      }));
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Criar plano
  app.post("/api/admin/subscription-plans", requireAuth, async (req, res) => {
    try {
      const { name, description, value, billingDay } = req.body;
      if (!name || !value) return res.status(400).json({ message: "Nome e valor são obrigatórios" });
      const day = Number(billingDay) || 10;
      if (day < 1 || day > 28) return res.status(400).json({ message: "Dia de cobrança deve ser entre 1 e 28" });
      const workspaceId = getSessionWorkspace(req);
      const plan = await storage.createSubscriptionPlan({
        name,
        description: description || null,
        value: String(Number(value).toFixed(2)),
        billingDay: day,
        isActive: true,
        shareId: "",
        workspaceId: workspaceId || null,
      });
      res.json({ ...plan, publicUrl: `/assinar/${plan.shareId}` });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Atualizar plano
  app.patch("/api/admin/subscription-plans/:id", requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { name, description, value, billingDay, isActive } = req.body;
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (value !== undefined) updateData.value = String(Number(value).toFixed(2));
      if (billingDay !== undefined) updateData.billingDay = Number(billingDay);
      if (isActive !== undefined) updateData.isActive = isActive;
      const updated = await storage.updateSubscriptionPlan(id, updateData);
      if (!updated) return res.status(404).json({ message: "Plano não encontrado" });
      res.json({ ...updated, publicUrl: `/assinar/${updated.shareId}` });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Deletar plano
  app.delete("/api/admin/subscription-plans/:id", requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await storage.deleteSubscriptionPlan(id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // Listar assinantes de um plano
  app.get("/api/admin/subscription-plans/:id/subscribers", requireAuth, async (req, res) => {
    try {
      const planId = Number(req.params.id);
      const subs = await storage.getSubscriptionsByPlanId(planId);
      const result = await Promise.all(subs.map(async (sub) => {
        const charges = await storage.getChargesBySubscriptionId(sub.id);
        return { ...sub, charges };
      }));
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Listar todos os assinantes do workspace
  app.get("/api/admin/subscriptions", requireAuth, async (req, res) => {
    try {
      const workspaceId = getSessionWorkspace(req);
      const subs = await storage.getAllSubscriptions(workspaceId);
      const plans = await storage.getAllSubscriptionPlans(workspaceId);
      const planMap = new Map(plans.map(p => [p.id, p]));
      const result = subs.map(sub => ({
        ...sub,
        planName: planMap.get(sub.planId)?.name || 'Plano desconhecido',
        planValue: planMap.get(sub.planId)?.value || '0',
      }));
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Cancelar assinatura (somente admin)
  app.post("/api/admin/subscriptions/:id/cancel", requireAuth, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const sub = await storage.getSubscription(id);
      if (!sub) return res.status(404).json({ message: "Assinatura não encontrada" });
      if (sub.status === 'CANCELLED') return res.status(400).json({ message: "Assinatura já cancelada" });

      // Cancela no Asaas se tiver autorização ativa
      if (sub.asaasAuthorizationId && sub.asaasAuthorizationStatus === 'ACTIVE') {
        try {
          await cancelPixAutomaticAuthorization(sub.asaasAuthorizationId, sub.workspaceId);
        } catch (err) {
          console.error('Erro ao cancelar autorização Asaas:', err);
        }
      }

      const cancelledBy = req.session?.adminEmail || req.session?.subAdminEmail || 'admin';
      await storage.updateSubscription(id, {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy,
        asaasAuthorizationStatus: 'CANCELLED',
      });
      res.json({ success: true });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // ===== CRON JOB: COBRANÇAS MENSAIS AUTOMÁTICAS =====
  // Este endpoint deve ser chamado diariamente por um serviço externo (ex: cron-job.org)
  // URL: POST /api/cron/billing?secret=CRON_SECRET
  app.post("/api/cron/billing", async (req, res) => {
    try {
      const secret = req.query.secret || req.headers["x-cron-secret"];
      const cronSecret = process.env.CRON_SECRET;
      if (cronSecret && secret !== cronSecret) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const activeSubs = await storage.getActiveSubscriptionsForBilling();
      const results: any[] = [];

      for (const sub of activeSubs) {
        try {
          if (!sub.asaasCustomerId || !sub.asaasAuthorizationId) continue;

          const plan = await storage.getSubscriptionPlan(sub.planId);
          if (!plan) continue;

          const dueDate = calcNextDueDate(plan.billingDay);

          // Cria cobrança PIX automático no Asaas
          const charge = await createPixAutomaticCharge({
            customerId: sub.asaasCustomerId,
            authorizationId: sub.asaasAuthorizationId,
            value: Number(plan.value),
            dueDate,
            description: `${plan.name} - ${new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`,
            workspaceId: sub.workspaceId,
          });

          // Registra a cobrança
          await storage.createSubscriptionCharge({
            subscriptionId: sub.id,
            asaasPaymentId: charge.id,
            value: String(charge.value),
            dueDate: charge.dueDate,
            status: "PENDING",
          });

          // Atualiza próxima cobrança
          const nextDate = new Date(dueDate);
          nextDate.setMonth(nextDate.getMonth() + 1);
          await storage.updateSubscription(sub.id, { nextChargeAt: nextDate });

          results.push({ subscriptionId: sub.id, chargeId: charge.id, status: "created" });
        } catch (err: any) {
          results.push({ subscriptionId: sub.id, error: err.message });
        }
      }

      res.json({ processed: activeSubs.length, results });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // ===== FORMULÁRIO PÚBLICO DE ADESÃO =====

  // Obter dados do plano pelo shareId (público)
  app.get("/api/subscribe/:shareId", async (req, res) => {
    try {
      const plan = await storage.getSubscriptionPlanByShareId(req.params.shareId);
      if (!plan || !plan.isActive) return res.status(404).json({ message: "Plano não encontrado ou inativo" });
      res.json({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        value: plan.value,
        billingDay: plan.billingDay,
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  // Adesão ao plano (público) - cria assinante e retorna QR Code PIX
  app.post("/api/subscribe/:shareId", async (req, res) => {
    try {
      const plan = await storage.getSubscriptionPlanByShareId(req.params.shareId);
      if (!plan || !plan.isActive) return res.status(404).json({ message: "Plano não encontrado ou inativo" });

      const { name, cpf, email, phone, jerseySize } = req.body;
      if (!name || !cpf || !email) return res.status(400).json({ message: "Nome, CPF e email são obrigatórios" });

      // Verifica se já existe assinatura ativa para este CPF neste plano
      const existingSubs = await storage.getSubscriptionsByPlanId(plan.id);
      const existing = existingSubs.find(s => s.cpf.replace(/\D/g, '') === cpf.replace(/\D/g, '') && s.status !== 'CANCELLED');
      if (existing) return res.status(400).json({ message: "Já existe uma assinatura ativa para este CPF neste plano" });

      // Cria cliente no Asaas
      let asaasCustomerId: string | null = null;
      let pixQrCode: string | null = null;
      let pixPayload: string | null = null;
      let pixExpiresAt: Date | null = null;
      let asaasAuthorizationId: string | null = null;
      let asaasAuthorizationStatus = 'PENDING';

      const payConfigured = await isConfigured(plan.workspaceId);
      if (payConfigured) {
        try {
          const customer = await createCustomer(name, cpf, phone || '', plan.workspaceId);
          asaasCustomerId = customer.id;

          // Calcula a data do primeiro vencimento
          const dueDate = calcNextDueDate(plan.billingDay);

          // Cria autorização PIX automático
          const auth = await createPixAutomaticAuthorization({
            customerId: customer.id,
            value: Number(plan.value),
            description: `Assinatura ${plan.name}`,
            startDate: dueDate,
            contractId: `plan-${plan.id}`,
            workspaceId: plan.workspaceId,
          });

          asaasAuthorizationId = auth.id;
          asaasAuthorizationStatus = auth.status || 'PENDING';

          // O Asaas retorna encodedImage e payload no nível raiz da resposta
          // O objeto immediateQrCode contém apenas conciliationIdentifier e expirationDate
          if (auth.encodedImage) {
            pixQrCode = auth.encodedImage;
          }
          if (auth.payload) {
            pixPayload = auth.payload;
          }
          if (auth.immediateQrCode?.expirationDate) {
            pixExpiresAt = new Date(auth.immediateQrCode.expirationDate);
          }
        } catch (err) {
          console.error('Erro ao criar autorização PIX:', err);
          // Continua sem PIX - assinatura fica PENDING
        }
      }

      // Calcula próxima cobrança
      const nextChargeDate = calcNextDueDate(plan.billingDay);
      const nextChargeAt = new Date(nextChargeDate);

      const subscription = await storage.createSubscription({
        planId: plan.id,
        workspaceId: plan.workspaceId || null,
        name,
        cpf: cpf.replace(/\D/g, ''),
        email,
        phone: phone ? phone.replace(/\D/g, '') : null,
        jerseySize: jerseySize || null,
        asaasCustomerId,
        asaasAuthorizationId,
        asaasAuthorizationStatus,
        pixQrCode,
        pixPayload,
        pixExpiresAt,
        status: 'PENDING',
        nextChargeAt,
      });

      res.json({
        id: subscription.id,
        status: subscription.status,
        pixQrCode: subscription.pixQrCode,
        pixPayload: subscription.pixPayload,
        pixExpiresAt: subscription.pixExpiresAt,
        planName: plan.name,
        value: plan.value,
        message: pixQrCode
          ? 'Escaneie o QR Code PIX para autorizar a assinatura recorrente'
          : 'Assinatura criada. Aguardando configuração do pagamento.',
      });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // ===== WEBHOOK PIX AUTOMÁTICO ASAAS =====
  app.post("/api/webhook/pix-automatic", async (req, res) => {
    try {
      const { event, payment, pixAutomaticAuthorization } = req.body;

      // Evento de autorização PIX automático ativada
      if (event === 'PIX_AUTOMATIC_AUTHORIZATION_ACTIVATED' && pixAutomaticAuthorization) {
        const authId = pixAutomaticAuthorization.id;
        // Busca a assinatura pelo authorizationId
        const allSubs = await storage.getAllSubscriptions();
        const sub = allSubs.find(s => s.asaasAuthorizationId === authId);
        if (sub) {
          await storage.updateSubscription(sub.id, {
            status: 'ACTIVE',
            asaasAuthorizationStatus: 'ACTIVE',
          });
        }
      }

      // Evento de autorização cancelada/expirada
      if (['PIX_AUTOMATIC_AUTHORIZATION_CANCELLED', 'PIX_AUTOMATIC_AUTHORIZATION_EXPIRED'].includes(event) && pixAutomaticAuthorization) {
        const authId = pixAutomaticAuthorization.id;
        const allSubs = await storage.getAllSubscriptions();
        const sub = allSubs.find(s => s.asaasAuthorizationId === authId);
        if (sub) {
          await storage.updateSubscription(sub.id, {
            status: event.includes('CANCELLED') ? 'CANCELLED' : 'EXPIRED',
            asaasAuthorizationStatus: event.includes('CANCELLED') ? 'CANCELLED' : 'EXPIRED',
          });
        }
      }

      // Evento de pagamento recorrente recebido
      if (['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'].includes(event) && payment) {
        const allSubs = await storage.getAllSubscriptions();
        const sub = allSubs.find(s => s.asaasCustomerId === payment.customer);
        if (sub) {
          // Registra cobrança
          const existingCharges = await storage.getChargesBySubscriptionId(sub.id);
          const alreadyExists = existingCharges.find(c => c.asaasPaymentId === payment.id);
          if (!alreadyExists) {
            await storage.createSubscriptionCharge({
              subscriptionId: sub.id,
              asaasPaymentId: payment.id,
              value: String(payment.value),
              dueDate: payment.dueDate,
              status: 'CONFIRMED',
            });
          } else {
            await storage.updateSubscriptionCharge(alreadyExists.id, { status: 'CONFIRMED' });
          }
          // Atualiza última cobrança
          const plan = await storage.getSubscriptionPlan(sub.planId);
          const nextDate = plan ? calcNextDueDate(plan.billingDay) : null;
          await storage.updateSubscription(sub.id, {
            lastChargeAt: new Date(),
            nextChargeAt: nextDate ? new Date(nextDate) : undefined,
          });
        }
      }

      // Evento de pagamento vencido
      if (event === 'PAYMENT_OVERDUE' && payment) {
        const allSubs = await storage.getAllSubscriptions();
        const sub = allSubs.find(s => s.asaasCustomerId === payment.customer);
        if (sub) {
          const existingCharges = await storage.getChargesBySubscriptionId(sub.id);
          const charge = existingCharges.find(c => c.asaasPaymentId === payment.id);
          if (charge) {
            await storage.updateSubscriptionCharge(charge.id, { status: 'OVERDUE' });
          }
        }
      }

      res.json({ received: true });
    } catch (e: any) {
      console.error('Webhook PIX error:', e);
      res.status(500).json({ message: e.message });
    }
  });

  return httpServer;
}
