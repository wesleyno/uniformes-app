import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRequireAuth } from "@/lib/auth";
import { useParams, Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, User, CreditCard, ShoppingBag, History, CheckCircle, Link2, Shield } from "lucide-react";
import type { Order, FormResponse, JerseyOrder, ResponseAuditLog, OrderPayment } from "@shared/schema";

interface OrderDetailData {
  order: Order;
  response: FormResponse;
  jerseyOrders: (JerseyOrder & { jerseyName: string; jerseyPrice: string })[];
  paymentRecords: OrderPayment[];
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  AWAITING_PAYMENT: "Aguardando Pagamento",
  PAGAMENTO_PARCIAL: "Pagamento Parcial",
  PAID: "Pago",
  RECEIVED: "Pago",
  CONFIRMED: "Pago",
  OVERDUE: "Vencido",
  CANCELLED: "Cancelado",
  CANCELLED_BY_ADMIN: "Cancelado pelo Admin",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  AWAITING_PAYMENT: "bg-blue-100 text-blue-800",
  PAGAMENTO_PARCIAL: "bg-orange-100 text-orange-800",
  PAID: "bg-emerald-100 text-emerald-800",
  RECEIVED: "bg-emerald-100 text-emerald-800",
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  OVERDUE: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-800",
  CANCELLED_BY_ADMIN: "bg-red-100 text-red-800",
};

const FIELD_LABELS: Record<string, string> = {
  athleteName: "Nome do atleta",
  cpf: "CPF",
  phone: "Telefone",
  gender: "Gênero",
  size: "Tamanho",
  number: "Número",
  nickname: "Nome na camisa",
  quantity: "Quantidade",
  jerseyId: "Modelo",
  paymentStatus: "Status de pagamento",
  totalAmount: "Valor total",
};

function formatCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  return cpf;
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

function formatAuditChanges(log: ResponseAuditLog): string {
  const action = log.action;

  if (action === "CREATED") return "Pedido criado";
  if (action === "DELETED") return "Pedido removido";
  if (action === "PAYMENT_CONFIRMED") return "Admin confirmou pagamento manualmente";
  if (action === "ASAAS_PAYMENT_LINKED") return "Admin vinculou pagamento Asaas ao pedido";
  if (action === "PAYMENT_DIFF") return "Diferença de pagamento gerada após edição";
  if (action === "PAID_ITEM_PROTECTED") return "Item pago protegido contra edição";

  if ((action === "UPDATED" || action === "ADMIN_EDIT") && log.oldValue && log.newValue) {
    const oldVal = log.oldValue as Record<string, unknown>;
    const newVal = log.newValue as Record<string, unknown>;
    const changes: string[] = [];

    for (const key of Object.keys(newVal)) {
      const oldField = oldVal[key];
      const newField = newVal[key];
      if (JSON.stringify(oldField) !== JSON.stringify(newField)) {
        const label = FIELD_LABELS[key] || key;
        changes.push(`${label} alterado ${String(oldField ?? "-")} → ${String(newField ?? "-")}`);
      }
    }

    const prefix = action === "ADMIN_EDIT" ? "[Admin] " : "";
    return changes.length > 0 ? prefix + changes.join("; ") : prefix + "Atualização sem alterações visíveis";
  }

  return action;
}

export default function AdminOrderDetail() {
  const { isLoading: authLoading } = useRequireAuth();
  const params = useParams<{ id: string }>();
  const orderId = Number(params.id);
  const { toast } = useToast();
  const [asaasLinkId, setAsaasLinkId] = useState("");

  const { data, isLoading, error } = useQuery<OrderDetailData>({
    queryKey: ["/api/admin/orders", orderId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/orders/${orderId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Pedido não encontrado");
      return res.json();
    },
    enabled: !!orderId,
  });

  const responseId = data?.response?.id;

  const { data: auditLogs, isLoading: auditLoading } = useQuery<ResponseAuditLog[]>({
    queryKey: ["/api/admin/responses", responseId, "audit-log"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/responses/${responseId}/audit-log`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar histórico");
      return res.json();
    },
    enabled: !!responseId,
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/orders/${orderId}/confirm-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Erro ao confirmar pagamento");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders", orderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/responses", responseId, "audit-log"] });
      toast({ title: "Pagamento confirmado com sucesso." });
    },
    onError: (err: any) => {
      toast({ title: err.message || "Erro ao confirmar pagamento", variant: "destructive" });
    },
  });

  const linkAsaasPaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await fetch(`/api/admin/orders/${orderId}/link-asaas-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ asaasPaymentId: paymentId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Erro ao vincular pagamento");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/orders", orderId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/responses", responseId, "audit-log"] });
      toast({ title: "Pagamento Asaas vinculado com sucesso." });
      setAsaasLinkId("");
    },
    onError: (err: any) => {
      toast({ title: err.message || "Erro ao vincular pagamento", variant: "destructive" });
    },
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-lg text-muted-foreground" data-testid="text-order-not-found">Pedido não encontrado</p>
          <Link href="/admin/reports">
            <Button variant="secondary" className="rounded-lg" data-testid="button-back-to-reports">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar aos Relatórios
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { order, response, jerseyOrders, paymentRecords } = data;
  const totalVal = parseFloat(order.totalAmount) || 0;
  const paidVal = parseFloat(order.paidAmount) || 0;
  const saldo = totalVal - paidVal;
  const isPaidStatus = ["PAID", "RECEIVED", "CONFIRMED"].includes(order.paymentStatus);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Link href="/admin/reports">
              <Button variant="ghost" size="icon" className="rounded-lg" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold tracking-tight" data-testid="text-order-title">
                Pedido #{order.id}
              </h1>
              <p className="text-sm text-muted-foreground">Detalhes do pedido</p>
            </div>
          </div>
          <Badge className={`rounded-full ${STATUS_COLORS[order.paymentStatus] || ""}`} data-testid="badge-payment-status">
            {STATUS_LABELS[order.paymentStatus] || order.paymentStatus}
          </Badge>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="rounded-xl shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Cliente</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="font-medium" data-testid="text-customer-name">{order.customerName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">CPF</p>
                <p className="font-medium" data-testid="text-customer-cpf">{formatCpf(order.cpf)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Telefone</p>
                <p className="font-medium" data-testid="text-customer-phone">{formatPhone(order.phone)}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-md">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Pagamento</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge className={`rounded-full ${STATUS_COLORS[order.paymentStatus] || ""}`} data-testid="text-payment-status">
                  {STATUS_LABELS[order.paymentStatus] || order.paymentStatus}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                  <p className="font-medium text-lg" data-testid="text-payment-amount">
                    R$ {totalVal.toFixed(2).replace(".", ",")}
                  </p>
                </div>
                {paidVal > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground">Valor Pago</p>
                    <p className="font-medium text-lg text-emerald-600 dark:text-emerald-400" data-testid="text-paid-amount">
                      R$ {paidVal.toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                )}
              </div>
              {saldo > 0.01 && !isPaidStatus && (
                <div>
                  <p className="text-sm text-muted-foreground">Saldo Pendente</p>
                  <p className="font-semibold text-orange-600 dark:text-orange-400" data-testid="text-balance-amount">
                    R$ {saldo.toFixed(2).replace(".", ",")}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground">Data</p>
                <p className="font-medium" data-testid="text-payment-date">
                  {order.createdAt ? new Date(order.createdAt).toLocaleDateString("pt-BR") : "-"}
                </p>
              </div>
              {order.asaasPaymentId && (
                <div>
                  <p className="text-sm text-muted-foreground">ID Asaas</p>
                  <p className="font-medium text-sm break-all" data-testid="text-asaas-id">{order.asaasPaymentId}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {!isPaidStatus && (
          <Card className="rounded-xl shadow-md border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Ações de Pagamento</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      className="rounded-lg"
                      disabled={confirmPaymentMutation.isPending}
                      data-testid="button-confirm-payment"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Confirmar Pagamento Manual
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar Pagamento</AlertDialogTitle>
                      <AlertDialogDescription>
                        Confirmar o pagamento de R$ {totalVal.toFixed(2).replace(".", ",")} manualmente?
                        Todos os itens do pedido serão marcados como pagos.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-lg">Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        className="rounded-lg"
                        onClick={() => confirmPaymentMutation.mutate()}
                      >
                        Confirmar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <div className="border-t pt-4">
                <Label className="text-sm font-medium mb-2 block">Vincular Pagamento Asaas</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="ID do pagamento Asaas (ex: pay_abc123)"
                    value={asaasLinkId}
                    onChange={(e) => setAsaasLinkId(e.target.value)}
                    className="rounded-lg"
                    data-testid="input-asaas-payment-id"
                  />
                  <Button
                    variant="outline"
                    className="rounded-lg shrink-0"
                    disabled={!asaasLinkId.trim() || linkAsaasPaymentMutation.isPending}
                    onClick={() => linkAsaasPaymentMutation.mutate(asaasLinkId.trim())}
                    data-testid="button-link-asaas"
                  >
                    <Link2 className="w-4 h-4 mr-1" />
                    Vincular
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="items" data-testid="tabs-order-detail">
          <TabsList>
            <TabsTrigger value="items" data-testid="tab-items">
              <ShoppingBag className="w-4 h-4 mr-2" />
              Itens do Pedido
            </TabsTrigger>
            {paymentRecords && paymentRecords.length > 0 && (
              <TabsTrigger value="payments" data-testid="tab-payments">
                <CreditCard className="w-4 h-4 mr-2" />
                Pagamentos
              </TabsTrigger>
            )}
            <TabsTrigger value="history" data-testid="tab-history">
              <History className="w-4 h-4 mr-2" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="items">
            <Card className="rounded-xl shadow-md">
              <CardContent className="pt-6">
                {jerseyOrders.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">Nenhum item encontrado</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Camisa</TableHead>
                          <TableHead>Número</TableHead>
                          <TableHead>Tamanho</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Qtd</TableHead>
                          <TableHead>Pago</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {jerseyOrders.map((jo) => (
                          <TableRow key={jo.id} data-testid={`row-jersey-order-${jo.id}`}>
                            <TableCell className="font-medium" data-testid={`text-jersey-name-${jo.id}`}>{jo.jerseyName}</TableCell>
                            <TableCell data-testid={`text-jersey-number-${jo.id}`}>{jo.number}</TableCell>
                            <TableCell data-testid={`text-jersey-size-${jo.id}`}>{jo.size}</TableCell>
                            <TableCell data-testid={`text-jersey-nickname-${jo.id}`}>{jo.nickname}</TableCell>
                            <TableCell data-testid={`text-jersey-quantity-${jo.id}`}>{jo.quantity}</TableCell>
                            <TableCell data-testid={`text-jersey-paid-${jo.id}`}>
                              {jo.paid ? (
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold text-lg" title={jo.paidAt ? `Pago em ${new Date(jo.paidAt).toLocaleDateString("pt-BR")}` : ""}>✔</span>
                              ) : (
                                <span className="text-red-500 font-bold text-lg">✘</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {paymentRecords && paymentRecords.length > 0 && (
            <TabsContent value="payments">
              <Card className="rounded-xl shadow-md">
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID Asaas</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Admin</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paymentRecords.map((pr) => (
                          <TableRow key={pr.id} data-testid={`row-payment-${pr.id}`}>
                            <TableCell className="font-mono text-xs break-all" data-testid={`text-payment-asaas-id-${pr.id}`}>
                              {pr.asaasPaymentId || "-"}
                            </TableCell>
                            <TableCell data-testid={`text-payment-value-${pr.id}`}>
                              R$ {parseFloat(pr.amount).toFixed(2).replace(".", ",")}
                            </TableCell>
                            <TableCell data-testid={`text-payment-record-status-${pr.id}`}>
                              <Badge className={`rounded-full text-xs ${pr.status === "CONFIRMED_MANUAL" ? "bg-emerald-100 text-emerald-800" : pr.status === "PAID" ? "bg-emerald-100 text-emerald-800" : "bg-blue-100 text-blue-800"}`}>
                                {pr.status === "CONFIRMED_MANUAL" ? "Manual" : pr.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm" data-testid={`text-payment-admin-${pr.id}`}>
                              {pr.confirmedByAdmin ? (pr.confirmedByEmail || "Admin") : "-"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm" data-testid={`text-payment-record-date-${pr.id}`}>
                              {pr.createdAt ? new Date(pr.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="history">
            <Card className="rounded-xl shadow-md">
              <CardContent className="pt-6">
                {auditLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : !auditLogs || auditLogs.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground" data-testid="text-no-audit-logs">
                    Nenhum registro de alteração encontrado
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Usuário</TableHead>
                          <TableHead>Alteração</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLogs.map((log) => (
                          <TableRow key={log.id} data-testid={`row-audit-log-${log.id}`}>
                            <TableCell className="whitespace-nowrap" data-testid={`text-audit-date-${log.id}`}>
                              {log.createdAt
                                ? new Date(log.createdAt).toLocaleString("pt-BR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "-"}
                            </TableCell>
                            <TableCell data-testid={`text-audit-user-${log.id}`}>
                              {log.changedBy}
                            </TableCell>
                            <TableCell data-testid={`text-audit-change-${log.id}`}>
                              {formatAuditChanges(log)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
