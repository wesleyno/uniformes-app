import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Search, ExternalLink, Shirt } from "lucide-react";
import type { Order } from "@shared/schema";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  AWAITING_PAYMENT: "Aguardando Pagamento",
  PAID: "Pago",
  OVERDUE: "Vencido",
  CANCELLED: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  AWAITING_PAYMENT: "bg-blue-100 text-blue-800",
  PAID: "bg-emerald-100 text-emerald-800",
  OVERDUE: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-800",
};

export default function PayOrder() {
  const { toast } = useToast();
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [orders, setOrders] = useState<Order[] | null>(null);

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return `(${digits}`;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const lookupMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/orders/lookup?cpf=${encodeURIComponent(cpf)}&phone=${encodeURIComponent(phone)}`);
      if (!res.ok) throw new Error("Nenhum pedido encontrado");
      return res.json();
    },
    onSuccess: (data: Order[]) => {
      setOrders(data);
      if (data.length === 0) {
        toast({ title: "Nenhum pedido encontrado para este CPF e telefone.", variant: "destructive" });
      }
    },
    onError: () => {
      setOrders([]);
      toast({ title: "Nenhum pedido encontrado para este CPF e telefone.", variant: "destructive" });
    },
  });

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (orders && orders.some(o => o.paymentStatus !== "PAID" && o.paymentStatus !== "CANCELLED")) {
      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/orders/lookup?cpf=${encodeURIComponent(cpf)}&phone=${encodeURIComponent(phone)}`);
          if (res.ok) {
            const data: Order[] = await res.json();
            setOrders(data);
          }
        } catch {}
      }, 5000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [orders, cpf, phone]);

  return (
    <div className="min-h-screen bg-background">
      <div className="h-1.5 w-full bg-primary" />
      <div className="max-w-lg mx-auto px-4 py-10 space-y-6 lg:max-w-2xl">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <CreditCard className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-pay-title">Pagar Pedido Existente</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Informe seus dados para encontrar seu pedido e realizar o pagamento
          </p>
        </div>

        <Card className="rounded-xl shadow-md">
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CPF</Label>
                <Input
                  value={cpf}
                  onChange={e => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  className="rounded-lg"
                  data-testid="input-pay-cpf"
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone / WhatsApp</Label>
                <Input
                  value={phone}
                  onChange={e => setPhone(formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className="rounded-lg"
                  data-testid="input-pay-phone"
                />
              </div>
            </div>
            <Button
              onClick={() => lookupMutation.mutate()}
              disabled={lookupMutation.isPending || !cpf || !phone}
              className="w-full rounded-lg"
              data-testid="button-search-order"
            >
              <Search className="w-4 h-4 mr-2" />
              {lookupMutation.isPending ? "Buscando..." : "Buscar Pedido"}
            </Button>
          </CardContent>
        </Card>

        {orders && orders.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Seus Pedidos</h2>
            {orders.map(order => (
              <Card key={order.id} className="rounded-xl shadow-md" data-testid={`card-order-${order.id}`}>
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shirt className="w-4 h-4 text-primary" />
                      <span className="font-semibold">Pedido #{order.id}</span>
                    </div>
                    <Badge className={`rounded-full ${STATUS_COLORS[order.paymentStatus] || ""}`}>
                      {STATUS_LABELS[order.paymentStatus] || order.paymentStatus}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Valor:</span>
                      <p className="font-semibold">R$ {parseFloat(order.totalAmount).toFixed(2).replace(".", ",")}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Data:</span>
                      <p>{order.createdAt ? new Date(order.createdAt).toLocaleDateString("pt-BR") : "-"}</p>
                    </div>
                  </div>
                  {order.paymentStatus !== "PAID" && order.paymentStatus !== "CANCELLED" && order.asaasPaymentUrl && (
                    <Button
                      className="w-full rounded-lg"
                      onClick={() => window.open(order.asaasPaymentUrl!, "_blank")}
                      data-testid={`button-pay-now-${order.id}`}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Pagar Agora
                    </Button>
                  )}
                  {order.paymentStatus === "PAID" && (
                    <div className="text-center text-sm text-emerald-600 font-medium py-2">
                      Pagamento confirmado
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {orders && orders.length === 0 && (
          <Card className="rounded-xl">
            <CardContent className="pt-8 pb-8 text-center">
              <p className="text-muted-foreground">Nenhum pedido encontrado para estes dados.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
