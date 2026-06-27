import { storage } from "./storage";

// Obtém a URL base da API do Asaas conforme o ambiente configurado
async function getAsaasBase(workspaceId?: number | null): Promise<string> {
  const settings = workspaceId
    ? await storage.getPaymentSettingsByWorkspace(workspaceId)
    : await storage.getPaymentSettings();
  const env = settings?.environment || "sandbox";
  return env === "production"
    ? "https://api.asaas.com/v3"
    : "https://sandbox.asaas.com/api/v3";
}

// Obtém a API key do Asaas conforme o workspace
async function getApiKey(workspaceId?: number | null): Promise<string | null> {
  const settings = workspaceId
    ? await storage.getPaymentSettingsByWorkspace(workspaceId)
    : await storage.getPaymentSettings();
  return settings?.asaasApiKey || null;
}

// Verifica se o Asaas está configurado (sem workspace = admin principal)
export async function isConfigured(workspaceId?: number | null): Promise<boolean> {
  const key = await getApiKey(workspaceId);
  return !!key;
}

// Cria um cliente no Asaas
export async function createCustomer(
  name: string,
  cpf: string,
  phone: string,
  workspaceId?: number | null
): Promise<{ id: string }> {
  const apiKey = await getApiKey(workspaceId);
  if (!apiKey) throw new Error("Asaas não configurado");
  const base = await getAsaasBase(workspaceId);

  const res = await fetch(`${base}/customers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
    },
    body: JSON.stringify({
      name,
      cpfCnpj: cpf.replace(/\D/g, ""),
      mobilePhone: phone.replace(/\D/g, ""),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Asaas createCustomer error: ${JSON.stringify(err)}`);
  }
  return res.json();
}

// Cria uma cobrança no Asaas (boleto/pix convencional)
export async function createPayment(
  customerId: string,
  value: number,
  description: string,
  dueDate: string,
  workspaceId?: number | null
): Promise<{ id: string; invoiceUrl?: string; bankSlipUrl?: string; pixQrCode?: { encodedImage: string; payload: string; expirationDate: string } }> {
  const apiKey = await getApiKey(workspaceId);
  if (!apiKey) throw new Error("Asaas não configurado");
  const base = await getAsaasBase(workspaceId);

  const res = await fetch(`${base}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
    },
    body: JSON.stringify({
      customer: customerId,
      billingType: "UNDEFINED",
      value,
      dueDate,
      description,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Asaas createPayment error: ${JSON.stringify(err)}`);
  }
  return res.json();
}

// Obtém uma cobrança do Asaas
export async function getPayment(
  paymentId: string,
  workspaceId?: number | null
): Promise<any> {
  const apiKey = await getApiKey(workspaceId);
  if (!apiKey) throw new Error("Asaas não configurado");
  const base = await getAsaasBase(workspaceId);

  const res = await fetch(`${base}/payments/${paymentId}`, {
    headers: { access_token: apiKey },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Asaas getPayment error: ${JSON.stringify(err)}`);
  }
  return res.json();
}

// ===== PIX AUTOMÁTICO =====

// Cria uma autorização de PIX automático (jornada 3 - QR Code imediato)
// Endpoint correto: POST /v3/pix/automatic/authorizations
export async function createPixAutomaticAuthorization(params: {
  customerId: string;
  value: number;
  description: string;
  startDate: string; // YYYY-MM-DD - data de início da vigência
  contractId: string; // max 35 chars - identificador do contrato/plano
  workspaceId?: number | null;
}): Promise<{
  id: string;
  status: string;
  encodedImage: string;       // QR Code em base64 - nível raiz da resposta
  payload: string;            // Código copia e cola PIX - nível raiz da resposta
  immediateQrCode: {
    conciliationIdentifier: string;
    expirationDate: string;   // Data de expiração do QR Code
  };
}> {
  const { customerId, value, description, startDate, contractId, workspaceId } = params;
  const apiKey = await getApiKey(workspaceId);
  if (!apiKey) throw new Error("Asaas não configurado");
  const base = await getAsaasBase(workspaceId);

  // Limita description e contractId a 35 chars conforme documentação
  const safeDescription = description.substring(0, 35);
  const safeContractId = contractId.substring(0, 35);

  const body = {
    customerId,
    frequency: "MONTHLY",
    contractId: safeContractId,
    startDate,
    description: safeDescription,
    value,
    immediateQrCode: {
      paymentCreationMode: "MANUAL",
      expirationSeconds: 86400, // 24 horas para o pagador escanear o QR Code
      originalValue: value, // valor do primeiro pagamento (mesmo valor da assinatura)
    },
  };

  console.log("Asaas createPixAuthorization body:", JSON.stringify(body));

  const res = await fetch(`${base}/pix/automatic/authorizations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "NTeamKit/1.0.0",
      access_token: apiKey,
    },
    body: JSON.stringify(body),
  });

  const responseText = await res.text();
  console.log("Asaas createPixAuthorization response status:", res.status);
  console.log("Asaas createPixAuthorization response body:", responseText);

  if (!res.ok) {
    let errObj: any = {};
    try { errObj = JSON.parse(responseText); } catch {}
    throw new Error(`Asaas createPixAuthorization error ${res.status}: ${responseText}`);
  }

  const data = JSON.parse(responseText);
  return data;
}

// Cria uma cobrança recorrente vinculada a uma autorização PIX automático
export async function createPixAutomaticCharge(params: {
  customerId: string;
  authorizationId: string;
  value: number;
  dueDate: string; // YYYY-MM-DD - deve ser 2-10 dias úteis no futuro
  description: string;
  workspaceId?: number | null;
}): Promise<{ id: string; status: string; value: number; dueDate: string }> {
  const { customerId, authorizationId, value, dueDate, description, workspaceId } = params;
  const apiKey = await getApiKey(workspaceId);
  if (!apiKey) throw new Error("Asaas não configurado");
  const base = await getAsaasBase(workspaceId);

  const res = await fetch(`${base}/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      access_token: apiKey,
    },
    body: JSON.stringify({
      customer: customerId,
      billingType: "PIX",
      value,
      dueDate,
      description,
      pixAutomaticAuthorizationId: authorizationId,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Asaas createPixCharge error: ${JSON.stringify(err)}`);
  }
  return res.json();
}

// Cancela uma autorização PIX automático
export async function cancelPixAutomaticAuthorization(
  authorizationId: string,
  workspaceId?: number | null
): Promise<void> {
  const apiKey = await getApiKey(workspaceId);
  if (!apiKey) throw new Error("Asaas não configurado");
  const base = await getAsaasBase(workspaceId);

  const res = await fetch(`${base}/pix/automatic/authorizations/${authorizationId}/cancel`, {
    method: "POST",
    headers: { access_token: apiKey },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Asaas cancelPixAuthorization error: ${JSON.stringify(err)}`);
  }
}

// Calcula a próxima data de vencimento válida para cobrança PIX automático
// (entre 2 e 10 dias úteis antes do vencimento desejado)
export function calcNextDueDate(billingDay: number): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Tenta o próximo mês com o dia de cobrança
  let target = new Date(year, month, billingDay);
  if (target <= now) {
    target = new Date(year, month + 1, billingDay);
  }

  // A instrução deve ser criada 2-10 dias úteis antes do vencimento
  // Criamos a cobrança 5 dias antes (meio do intervalo seguro)
  const createDate = new Date(target);
  createDate.setDate(createDate.getDate() - 5);

  // Formata como YYYY-MM-DD
  return target.toISOString().split("T")[0];
}
