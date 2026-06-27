import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Users, Link, Copy, Pencil, Trash2, X, CheckCircle, Clock, AlertCircle, Ban, QrCode, Loader2 } from "lucide-react";

interface SubscriptionPlan {
  id: number;
  name: string;
  description: string | null;
  value: string;
  billingDay: number;
  isActive: boolean;
  shareId: string;
  publicUrl: string;
  subscriberCount: number;
  totalSubscribers: number;
  createdAt: string;
}

interface Subscription {
  id: number;
  planId: number;
  planName: string;
  planValue: string;
  name: string;
  cpf: string;
  email: string;
  phone: string | null;
  jerseySize: string | null;
  status: string;
  asaasAuthorizationStatus: string;
  createdAt: string;
  nextChargeAt: string | null;
  lastChargeAt: string | null;
  pixQrCode: string | null;
  pixPayload: string | null;
  pixExpiresAt: string | null;
}

function statusBadge(status: string) {
  switch (status) {
    case "ACTIVE":
      return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Ativo</Badge>;
    case "PENDING":
      return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
    case "CANCELLED":
      return <Badge className="bg-red-100 text-red-800"><Ban className="w-3 h-3 mr-1" />Cancelado</Badge>;
    case "EXPIRED":
      return <Badge className="bg-gray-100 text-gray-800"><AlertCircle className="w-3 h-3 mr-1" />Expirado</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function AdminSubscriptions() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<SubscriptionPlan | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [cancellingSubscription, setCancellingSubscription] = useState<Subscription | null>(null);
  const [qrCodeModal, setQrCodeModal] = useState<{ pixQrCode: string; pixPayload: string; pixExpiresAt: string | null } | null>(null);
  const [generatingQrFor, setGeneratingQrFor] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"plans" | "subscribers">("plans");

  const [planForm, setPlanForm] = useState({
    name: "",
    description: "",
    value: "",
    billingDay: "10",
  });

  // Buscar planos
  const { data: plans = [], isLoading: loadingPlans } = useQuery<SubscriptionPlan[]>({
    queryKey: ["/api/admin/subscription-plans"],
  });

  // Buscar todos os assinantes
  const { data: subscriptions = [], isLoading: loadingSubs } = useQuery<Subscription[]>({
    queryKey: ["/api/admin/subscriptions"],
  });

  // Buscar assinantes de um plano específico
  const { data: planSubscribers = [] } = useQuery<Subscription[]>({
    queryKey: ["/api/admin/subscription-plans", selectedPlan?.id, "subscribers"],
    queryFn: async () => {
      if (!selectedPlan) return [];
      const res = await fetch(`/api/admin/subscription-plans/${selectedPlan.id}/subscribers`);
      return res.json();
    },
    enabled: !!selectedPlan,
  });

  // Criar plano
  const createPlan = useMutation({
    mutationFn: async (data: typeof planForm) => {
      const res = await fetch("/api/admin/subscription-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao criar plano");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription-plans"] });
      setShowPlanForm(false);
      setPlanForm({ name: "", description: "", value: "", billingDay: "10" });
      toast({ title: "Plano criado com sucesso!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // Atualizar plano
  const updatePlan = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof planForm> }) => {
      const res = await fetch(`/api/admin/subscription-plans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao atualizar plano");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription-plans"] });
      setEditingPlan(null);
      toast({ title: "Plano atualizado com sucesso!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // Deletar plano
  const deletePlan = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/subscription-plans/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao deletar plano");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription-plans"] });
      setDeletingPlan(null);
      toast({ title: "Plano removido com sucesso!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  // Gerar QR Code para assinatura pendente
  const generateQrCode = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/subscriptions/${id}/generate-qrcode`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao gerar QR Code");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      if (selectedPlan) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription-plans", selectedPlan.id, "subscribers"] });
      }
      setGeneratingQrFor(null);
      if (data.pixQrCode) {
        setQrCodeModal({ pixQrCode: data.pixQrCode, pixPayload: data.pixPayload, pixExpiresAt: data.pixExpiresAt });
        toast({ title: "QR Code gerado com sucesso!" });
      } else {
        toast({ title: "Autorização criada", description: "QR Code não disponível no momento." });
      }
    },
    onError: (e: Error) => {
      setGeneratingQrFor(null);
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });

  // Cancelar assinatura
  const cancelSubscription = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/subscriptions/${id}/cancel`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Erro ao cancelar assinatura");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription-plans"] });
      if (selectedPlan) {
        queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription-plans", selectedPlan.id, "subscribers"] });
      }
      setCancellingSubscription(null);
      toast({ title: "Assinatura cancelada com sucesso!" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  function copyLink(shareId: string) {
    const url = `${window.location.origin}/assinar/${shareId}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!", description: url });
  }

  function openEditPlan(plan: SubscriptionPlan) {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      description: plan.description || "",
      value: plan.value,
      billingDay: String(plan.billingDay),
    });
  }

  function handlePlanSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingPlan) {
      updatePlan.mutate({ id: editingPlan.id, data: planForm });
    } else {
      createPlan.mutate(planForm);
    }
  }

  const displayedSubscriptions = selectedPlan ? planSubscribers : subscriptions;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/")}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Assinaturas PIX Automático</h1>
          <p className="text-sm text-gray-500">Gerencie planos de assinatura mensal recorrente</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={activeTab === "plans" ? "default" : "outline"}
            onClick={() => { setActiveTab("plans"); setSelectedPlan(null); }}
          >
            Planos
          </Button>
          <Button
            variant={activeTab === "subscribers" ? "default" : "outline"}
            onClick={() => setActiveTab("subscribers")}
          >
            <Users className="w-4 h-4 mr-2" />
            Todos os Assinantes
          </Button>
        </div>

        {/* Tab: Planos */}
        {activeTab === "plans" && !selectedPlan && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Planos de Assinatura</h2>
              <Button onClick={() => { setShowPlanForm(true); setEditingPlan(null); setPlanForm({ name: "", description: "", value: "", billingDay: "10" }); }}>
                <Plus className="w-4 h-4 mr-2" />
                Novo Plano
              </Button>
            </div>

            {loadingPlans ? (
              <div className="text-center py-12 text-gray-500">Carregando planos...</div>
            ) : plans.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  <p className="mb-2">Nenhum plano criado ainda.</p>
                  <p className="text-sm">Crie um plano para começar a receber assinaturas via PIX automático.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {plans.map((plan) => (
                  <Card key={plan.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-base">{plan.name}</CardTitle>
                        <Badge variant={plan.isActive ? "default" : "secondary"}>
                          {plan.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {plan.description && (
                        <p className="text-sm text-gray-500 mb-3">{plan.description}</p>
                      )}
                      <div className="space-y-1 mb-4">
                        <p className="text-2xl font-bold text-green-600">
                          R$ {Number(plan.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          <span className="text-sm font-normal text-gray-500">/mês</span>
                        </p>
                        <p className="text-xs text-gray-500">Vencimento: dia {plan.billingDay} de cada mês</p>
                        <p className="text-xs text-gray-500">
                          {plan.subscriberCount} ativo{plan.subscriberCount !== 1 ? "s" : ""} · {plan.totalSubscribers} total
                        </p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" variant="outline" onClick={() => copyLink(plan.shareId)}>
                          <Copy className="w-3 h-3 mr-1" />
                          Copiar Link
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setSelectedPlan(plan); setActiveTab("subscribers"); }}>
                          <Users className="w-3 h-3 mr-1" />
                          Assinantes
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEditPlan(plan)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => setDeletingPlan(plan)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* Tab: Assinantes */}
        {(activeTab === "subscribers" || selectedPlan) && (
          <>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                {selectedPlan && (
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedPlan(null); setActiveTab("plans"); }}>
                    <ArrowLeft className="w-4 h-4 mr-1" />
                  </Button>
                )}
                <h2 className="text-lg font-semibold">
                  {selectedPlan ? `Assinantes — ${selectedPlan.name}` : "Todos os Assinantes"}
                </h2>
              </div>
            </div>

            {loadingSubs ? (
              <div className="text-center py-12 text-gray-500">Carregando assinantes...</div>
            ) : displayedSubscriptions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  Nenhum assinante encontrado.
                </CardContent>
              </Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Tamanho</TableHead>
                      {!selectedPlan && <TableHead>Plano</TableHead>}
                      <TableHead>Status</TableHead>
                      <TableHead>Próx. Cobrança</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedSubscriptions.map((sub: any) => (
                      <TableRow key={sub.id}>
                        <TableCell className="font-medium">{sub.name}</TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {sub.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                        </TableCell>
                        <TableCell className="text-sm">{sub.email}</TableCell>
                        <TableCell className="text-sm">{sub.jerseySize || "—"}</TableCell>
                        {!selectedPlan && <TableCell className="text-sm">{sub.planName}</TableCell>}
                        <TableCell>{statusBadge(sub.status)}</TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {sub.nextChargeAt
                            ? new Date(sub.nextChargeAt).toLocaleDateString("pt-BR")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {sub.status === "PENDING" && !sub.pixQrCode && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-blue-600 hover:text-blue-700"
                                disabled={generatingQrFor === sub.id}
                                onClick={() => { setGeneratingQrFor(sub.id); generateQrCode.mutate(sub.id); }}
                              >
                                {generatingQrFor === sub.id ? (
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                ) : (
                                  <QrCode className="w-3 h-3 mr-1" />
                                )}
                                Gerar QR
                              </Button>
                            )}
                            {sub.status !== "CANCELLED" && sub.status !== "EXPIRED" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => setCancellingSubscription(sub)}
                              >
                                <X className="w-3 h-3 mr-1" />
                                Cancelar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Modal: Criar/Editar Plano */}
      <Dialog open={showPlanForm || !!editingPlan} onOpenChange={(open) => { if (!open) { setShowPlanForm(false); setEditingPlan(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPlan ? "Editar Plano" : "Novo Plano de Assinatura"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePlanSubmit} className="space-y-4">
            <div>
              <Label htmlFor="plan-name">Nome do plano *</Label>
              <Input
                id="plan-name"
                placeholder="Ex: Camisa do Mês"
                value={planForm.name}
                onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="plan-desc">Descrição</Label>
              <Textarea
                id="plan-desc"
                placeholder="Descreva o que o assinante recebe..."
                value={planForm.description}
                onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="plan-value">Valor mensal (R$) *</Label>
                <Input
                  id="plan-value"
                  type="number"
                  step="0.01"
                  min="1"
                  placeholder="89.90"
                  value={planForm.value}
                  onChange={(e) => setPlanForm({ ...planForm, value: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="plan-day">Dia de vencimento *</Label>
                <Input
                  id="plan-day"
                  type="number"
                  min="1"
                  max="28"
                  placeholder="10"
                  value={planForm.billingDay}
                  onChange={(e) => setPlanForm({ ...planForm, billingDay: e.target.value })}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Entre 1 e 28</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowPlanForm(false); setEditingPlan(null); }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createPlan.isPending || updatePlan.isPending}>
                {editingPlan ? "Salvar Alterações" : "Criar Plano"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmar deletar plano */}
      <AlertDialog open={!!deletingPlan} onOpenChange={(open) => { if (!open) setDeletingPlan(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover plano?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso removerá o plano <strong>{deletingPlan?.name}</strong> e todos os dados de assinantes vinculados. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => deletingPlan && deletePlan.mutate(deletingPlan.id)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal: QR Code gerado */}
      <Dialog open={!!qrCodeModal} onOpenChange={(open) => { if (!open) setQrCodeModal(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR Code PIX Automático</DialogTitle>
          </DialogHeader>
          {qrCodeModal && (
            <div className="flex flex-col items-center gap-4">
              <img
                src={`data:image/png;base64,${qrCodeModal.pixQrCode}`}
                alt="QR Code PIX"
                className="w-52 h-52 border rounded"
              />
              <div className="w-full">
                <p className="text-xs text-gray-500 mb-1">Código copia e cola:</p>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={qrCodeModal.pixPayload}
                    className="flex-1 text-xs border rounded px-2 py-1 bg-gray-50 truncate"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { navigator.clipboard.writeText(qrCodeModal.pixPayload); toast({ title: "Copiado!" }); }}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              {qrCodeModal.pixExpiresAt && (
                <p className="text-xs text-gray-400">
                  Válido até: {new Date(qrCodeModal.pixExpiresAt).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setQrCodeModal(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar cancelar assinatura */}
      <AlertDialog open={!!cancellingSubscription} onOpenChange={(open) => { if (!open) setCancellingSubscription(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
            <AlertDialogDescription>
              A assinatura de <strong>{cancellingSubscription?.name}</strong> será cancelada imediatamente no Asaas. Nenhuma cobrança futura será realizada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => cancellingSubscription && cancelSubscription.mutate(cancellingSubscription.id)}
            >
              Cancelar Assinatura
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
