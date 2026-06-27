import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useRequireAuth } from "@/lib/auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CreditCard, Save, Shield, ExternalLink, Copy } from "lucide-react";

export default function AdminSettings() {
  const { isLoading: authLoading, can } = useRequireAuth();
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [environment, setEnvironment] = useState("sandbox");
  const [webhookUrl, setWebhookUrl] = useState("");

  const { data: settings, isLoading } = useQuery<{
    id: number;
    environment: string;
    webhookUrl: string | null;
    hasApiKey: boolean;
    createdAt: string;
  } | null>({
    queryKey: ["/api/admin/payment-settings"],
  });

  useEffect(() => {
    if (settings) {
      setEnvironment(settings.environment);
      setWebhookUrl(settings.webhookUrl || "");
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/payment-settings", {
        asaasApiKey: apiKey || undefined,
        environment,
        webhookUrl: webhookUrl || `${window.location.origin}/api/webhooks/asaas`,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/payment-settings"] });
      setApiKey("");
      toast({ title: "Configurações salvas com sucesso!" });
    },
    onError: (err: any) => {
      toast({ title: err.message || "Erro ao salvar configurações", variant: "destructive" });
    },
  });

  const generatedWebhookUrl = `${window.location.origin}/api/webhooks/asaas`;

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="rounded-lg" data-testid="button-back">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Configurações</h1>
            <p className="text-sm text-muted-foreground">Gerencie as configurações do sistema</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {!can("canConfigureAsaas") && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
            Você não tem permissão para configurar o Asaas. Entre em contato com o administrador.
          </div>
        )}
        <Card className="rounded-xl shadow-md" style={{ opacity: can("canConfigureAsaas") ? 1 : 0.5, pointerEvents: can("canConfigureAsaas") ? "auto" : "none" }}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Pagamentos — Asaas</CardTitle>
                <p className="text-sm text-muted-foreground">Configure a integração com o gateway de pagamento Asaas</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {settings?.hasApiKey && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <Shield className="w-4 h-4 text-emerald-600" />
                <span className="text-sm text-emerald-700 font-medium">API Key configurada</span>
                <Badge variant="secondary" className="ml-auto rounded-full text-xs">
                  {settings.environment === "production" ? "Produção" : "Sandbox"}
                </Badge>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="space-y-2">
                <Label>Ambiente</Label>
                <Select value={environment} onValueChange={setEnvironment}>
                  <SelectTrigger className="rounded-lg" data-testid="select-environment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox (Testes)</SelectItem>
                    <SelectItem value="production">Produção</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 lg:col-span-2">
                <Label>API Key do Asaas</Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder={settings?.hasApiKey ? "••••••• (já configurada — preencha para alterar)" : "Cole sua API Key aqui"}
                  className="rounded-lg font-mono"
                  data-testid="input-api-key"
                />
                <p className="text-xs text-muted-foreground">
                  Encontre sua API Key no painel do Asaas em Configurações → Integrações.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <div className="flex gap-2">
                <Input
                  value={generatedWebhookUrl}
                  readOnly
                  className="rounded-lg font-mono text-sm bg-muted/50"
                  data-testid="input-webhook-url"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-lg flex-shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedWebhookUrl);
                    toast({ title: "URL copiada!" });
                  }}
                  data-testid="button-copy-webhook"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Configure esta URL no painel do Asaas em Configurações → Integrações → Webhook.
              </p>
            </div>

            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || (!apiKey && !settings?.hasApiKey)}
              className="w-full lg:w-auto rounded-lg"
              data-testid="button-save-settings"
            >
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-md">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Política de Privacidade</CardTitle>
                <p className="text-sm text-muted-foreground">Configure a política de privacidade exibida nos formulários</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Link href="/admin/privacy-policy">
              <Button variant="outline" className="rounded-lg" data-testid="button-privacy-policy">
                <Shield className="w-4 h-4 mr-2" />
                Editar Política de Privacidade
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
