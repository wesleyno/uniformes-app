import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ShoppingBag, ExternalLink, Eye, ArrowLeft, XCircle } from "lucide-react";
import type { Order } from "@shared/schema";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  AWAITING_PAYMENT: "Aguardando Pagamento",
  PAGAMENTO_PARCIAL: "Pagamento Parcial",
  RECEIVED: "Pago",
  CONFIRMED: "Pago",
  PAID: "Pago",
  OVERDUE: "Vencido",
  CANCELLED: "Cancelado",
  CANCELLED_BY_ADMIN: "Cancelado pelo Admin",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "secondary",
  AWAITING_PAYMENT: "outline",
  PAGAMENTO_PARCIAL: "outline",
  RECEIVED: "default",
  CONFIRMED: "default",
  PAID: "default",
  OVERDUE: "destructive",
  CANCELLED: "destructive",
  CANCELLED_BY_ADMIN: "destructive",
};

function formatCpfDisplay(cpf: string) {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export default function MyOrders() {
  const params = useParams<{ cpf: string }>();
  const cpf = params.cpf || "";
  const { toast } = useToast();

  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders/by-cpf", cpf],
    queryFn: async () => {
      const res = await fetch(`/api/orders/by-cpf?cpf=${cpf}`, { credentials: "include" });
      if (!res.ok) throw new Error("Erro ao buscar pedidos");
      return res.json();
    },
    enabled: cpf.length === 11,
    refetchInterval: 10000,
  });

  const cancelMutation = useMutation({
    mutationFn: async (orderId: number) => {
      const res = await fetch(`/api/orders/${orderId}/cancel-by-customer`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ cpf }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Erro ao cancelar pedido.");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders/by-cpf", cpf] });
      toast({ title: "Pedido cancelado com sucesso." });
    },
    onError: (err: any) => {
      toast({ title: err.message || "Erro ao cancelar pedido.", variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="h-1.5 w-full bg-primary" />
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-my-orders-title">Meus Pedidos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            CPF: {formatCpfDisplay(cpf)}
          </p>
        </div>

        {isLoading && (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <Card key={i}>
                <CardContent className="pt-5 space-y-3">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {orders && orders.length > 0 && (
          <div className="space-y-4">
            {orders.map(order => (
              <Card key={order.id} data-testid={`card-order-${order.id}`}>
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-semibold" data-testid={`text-order-id-${order.id}`}>
                      Pedido #{order.id}
                    </span>
                    <Badge variant={STATUS_VARIANTS[order.paymentStatus] || "secondary"} data-testid={`badge-status-${order.id}`}>
                      {STATUS_LABELS[order.paymentStatus] || order.paymentStatus}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Valor Total:</span>
                      <p className="font-semibold" data-testid={`text-amount-${order.id}`}>
                        R$ {parseFloat(order.totalAmount).toFixed(2).replace(".", ",")}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Data:</span>
                      <p data-testid={`text-date-${order.id}`}>
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString("pt-BR") : "-"}
                      </p>
                    </div>
                    {parseFloat(order.paidAmount) > 0 && (
                      <div>
                        <span className="text-muted-foreground">Pago:</span>
                        <p className="font-semibold text-emerald-600 dark:text-emerald-400" data-testid={`text-paid-${order.id}`}>
                          R$ {parseFloat(order.paidAmount).toFixed(2).replace(".", ",")}
                        </p>
                      </div>
                    )}
                    {order.paymentStatus === "PAGAMENTO_PARCIAL" && (() => {
                      const saldo = parseFloat(order.totalAmount) - parseFloat(order.paidAmount);
                      return saldo > 0.01 ? (
                        <div>
                          <span className="text-muted-foreground">Saldo Pendente:</span>
                          <p className="font-semibold text-orange-600 dark:text-orange-400" data-testid={`text-balance-${order.id}`}>
                            R$ {saldo.toFixed(2).replace(".", ",")}
                          </p>
                        </div>
                      ) : null;
                    })()}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/pedido/${order.id}`}>
                      <Button variant="outline" size="sm" data-testid={`button-view-detail-${order.id}`}>
                        <Eye className="w-4 h-4 mr-1" />
                        Ver detalhes
                      </Button>
                    </Link>
                    {!["PAID", "RECEIVED", "CONFIRMED", "CANCELLED", "CANCELLED_BY_ADMIN"].includes(order.paymentStatus) && order.asaasPaymentUrl && (
                      <Button
                        size="sm"
                        onClick={() => window.open(order.asaasPaymentUrl!, "_blank")}
                        data-testid={`button-pay-${order.id}`}
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        {order.paymentStatus === "PAGAMENTO_PARCIAL" ? "Pagar diferença" : "Pagar"}
                      </Button>
                    )}
                    {["PENDING", "AWAITING_PAYMENT"].includes(order.paymentStatus) && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={cancelMutation.isPending}
                            data-testid={`button-cancel-order-${order.id}`}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Cancelar pedido
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancelar Pedido #{order.id}</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja cancelar este pedido? Os números escolhidos serão liberados e esta ação não poderá ser desfeita.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-lg">Voltar</AlertDialogCancel>
                            <AlertDialogAction
                              className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => cancelMutation.mutate(order.id)}
                            >
                              Confirmar cancelamento
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {orders && orders.length === 0 && (
          <Card>
            <CardContent className="pt-8 pb-8 text-center">
              <p className="text-muted-foreground" data-testid="text-no-orders">Nenhum pedido encontrado para este CPF.</p>
            </CardContent>
          </Card>
        )}

        <div className="text-center">
          <Link href="/pay">
            <Button variant="outline" data-testid="link-pay-order">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Pagar pedido existente
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
