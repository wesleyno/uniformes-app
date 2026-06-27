import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Copy, Loader2, ShieldCheck } from "lucide-react";

interface Plan {
  id: number;
  name: string;
  description: string | null;
  value: string;
  billingDay: number;
}

interface SubscriptionResult {
  id: number;
  status: string;
  pixQrCode: string | null;
  pixPayload: string | null;
  pixExpiresAt: string | null;
  planName: string;
  value: string;
  message: string;
}

function formatCPF(value: string) {
  return value
    .replace(/\D/g, "")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
    .slice(0, 14);
}

function formatPhone(value: string) {
  return value
    .replace(/\D/g, "")
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2")
    .slice(0, 15);
}

export default function SubscribePage() {
  const [, params] = useRoute("/assinar/:shareId");
  const shareId = params?.shareId || "";
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: "",
    cpf: "",
    email: "",
    phone: "",
    jerseySize: "",
  });
  const [result, setResult] = useState<SubscriptionResult | null>(null);

  const { data: plan, isLoading, error } = useQuery<Plan>({
    queryKey: ["/api/subscribe", shareId],
    queryFn: async () => {
      const res = await fetch(`/api/subscribe/${shareId}`);
      if (!res.ok) throw new Error("Plano não encontrado");
      return res.json();
    },
    enabled: !!shareId,
  });

  const subscribe = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await fetch(`/api/subscribe/${shareId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao processar assinatura");
      }
      return res.json() as Promise<SubscriptionResult>;
    },
    onSuccess: (data) => {
      setResult(data);
    },
    onError: (e: Error) => {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cpfClean = form.cpf.replace(/\D/g, "");
    if (cpfClean.length !== 11) {
      toast({ title: "CPF inválido", description: "Informe um CPF com 11 dígitos.", variant: "destructive" });
      return;
    }
    subscribe.mutate(form);
  }

  function copyPayload() {
    if (result?.pixPayload) {
      navigator.clipboard.writeText(result.pixPayload);
      toast({ title: "Código PIX copiado!" });
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 text-lg">Plano não encontrado ou inativo.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tela de sucesso com QR Code
  if (result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-3">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            <CardTitle className="text-xl">Assinatura Criada!</CardTitle>
            <p className="text-gray-500 text-sm mt-1">{result.message}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-500">Plano</p>
              <p className="font-semibold">{result.planName}</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                R$ {Number(result.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês
              </p>
            </div>

            {result.pixQrCode && (
              <div className="text-center space-y-3">
                <p className="text-sm font-medium text-gray-700">
                  Escaneie o QR Code abaixo para autorizar a cobrança recorrente via PIX:
                </p>
                <div className="flex justify-center">
                  <img
                    src={`data:image/png;base64,${result.pixQrCode}`}
                    alt="QR Code PIX"
                    className="w-48 h-48 border rounded-lg"
                  />
                </div>
                {result.pixPayload && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Ou copie o código PIX:</p>
                    <div className="flex gap-2">
                      <Input
                        value={result.pixPayload}
                        readOnly
                        className="text-xs font-mono"
                      />
                      <Button size="sm" variant="outline" onClick={copyPayload}>
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
                {result.pixExpiresAt && (
                  <p className="text-xs text-gray-400">
                    Válido até: {new Date(result.pixExpiresAt).toLocaleString("pt-BR")}
                  </p>
                )}
              </div>
            )}

            <div className="bg-blue-50 rounded-lg p-3 flex gap-2 text-sm text-blue-700">
              <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>Após o pagamento ser confirmado, sua assinatura será ativada automaticamente e as cobranças mensais serão realizadas via PIX automático.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Formulário de adesão
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{plan.name}</CardTitle>
          {plan.description && (
            <p className="text-gray-500 text-sm mt-1">{plan.description}</p>
          )}
          <div className="mt-3">
            <span className="text-3xl font-bold text-green-600">
              R$ {Number(plan.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-gray-500 text-sm">/mês</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Cobrado todo dia {plan.billingDay} via PIX automático
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nome completo *</Label>
              <Input
                id="name"
                placeholder="Seu nome completo"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="cpf">CPF *</Label>
              <Input
                id="cpf"
                placeholder="000.000.000-00"
                value={form.cpf}
                onChange={(e) => setForm({ ...form, cpf: formatCPF(e.target.value) })}
                required
              />
            </div>
            <div>
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="phone">Telefone / WhatsApp</Label>
              <Input
                id="phone"
                placeholder="(00) 00000-0000"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="size">Tamanho da camisa</Label>
              <select
                id="size"
                className="w-full border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.jerseySize}
                onChange={(e) => setForm({ ...form, jerseySize: e.target.value })}
              >
                <option value="">Selecione o tamanho</option>
                <option value="PP">PP</option>
                <option value="P">P</option>
                <option value="M">M</option>
                <option value="G">G</option>
                <option value="GG">GG</option>
                <option value="XGG">XGG</option>
                <option value="EXGG">EXGG</option>
              </select>
            </div>

            <div className="bg-blue-50 rounded-lg p-3 flex gap-2 text-xs text-blue-700">
              <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>Ao assinar, você autoriza cobranças mensais automáticas via PIX. Você pode cancelar a qualquer momento entrando em contato.</p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={subscribe.isPending}
            >
              {subscribe.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                "Assinar e Gerar PIX"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
