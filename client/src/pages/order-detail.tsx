import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ExternalLink, User, Shirt, CreditCard } from "lucide-react";

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

function formatPhoneDisplay(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
}

interface OrderDetail {
  order: {
    id: number;
    responseId: number;
    formId: number;
    customerName: string;
    cpf: string;
    phone: string;
    totalAmount: string;
    paidAmount: string;
    paymentStatus: string;
    asaasPaymentId: string | null;
    asaasPaymentUrl: string | null;
    createdAt: string | null;
  };
  response: {
    id: number;
    athleteName: string;
    cpf: string;
    phone: string;
    gender: string;
  } | null;
  jerseyOrders: Array<{
    id: number;
    jerseyId: number;
    quantity: number;
    size: string;
    number: string;
    nickname: string;
    jerseyName: string;
    jerseyPrice: string;
    jerseyImageUrl: string | null;
    extraNumbers: Array<{ number: string; nickname: string; size?: string }> | null;
  }>;
  form: {
    teamName: string;
    logoUrl: string | null;
  } | null;
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id || "";

  const { data, isLoading } = useQuery<OrderDetail>({
    queryKey: ["/api/orders", orderId, "detail"],
    enabled: !!orderId && orderId !== "",
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-1.5 w-full bg-primary" />
        <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Card><CardContent className="pt-5 space-y-3"><Skeleton className="h-20 w-full" /></CardContent></Card>
          <Card><CardContent className="pt-5 space-y-3"><Skeleton className="h-32 w-full" /></CardContent></Card>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-1.5 w-full bg-primary" />
        <div className="max-w-2xl mx-auto px-4 py-10 text-center space-y-4">
          <h1 className="text-2xl font-semibold">Pedido não encontrado</h1>
          <p className="text-muted-foreground">O pedido solicitado não existe ou foi removido.</p>
        </div>
      </div>
    );
  }

  const { order, jerseyOrders, form } = data;

  return (
    <div className="min-h-screen bg-background">
      <div className="h-1.5 w-full bg-primary" />
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/meus-pedidos/${order.cpf}`}>
            <Button variant="ghost" size="sm" data-testid="button-back-orders">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Voltar
            </Button>
          </Link>
        </div>

        <div className="text-center space-y-2">
          {form?.logoUrl && (
            <img src={form.logoUrl} alt={form.teamName} className="w-16 h-16 object-contain mx-auto rounded-md" data-testid="img-team-logo" />
          )}
          <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-order-detail-title">
            Pedido #{order.id}
          </h1>
          {form && <p className="text-muted-foreground text-sm">{form.teamName}</p>}
          <Badge variant={STATUS_VARIANTS[order.paymentStatus] || "secondary"} data-testid="badge-order-status">
            {STATUS_LABELS[order.paymentStatus] || order.paymentStatus}
          </Badge>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <User className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="text-base">Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-muted-foreground">Nome</span>
                <p className="font-medium" data-testid="text-customer-name">{order.customerName}</p>
              </div>
              <div>
                <span className="text-muted-foreground">CPF</span>
                <p className="font-medium" data-testid="text-customer-cpf">{formatCpfDisplay(order.cpf)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Telefone</span>
                <p className="font-medium" data-testid="text-customer-phone">{formatPhoneDisplay(order.phone)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <Shirt className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="text-base">Itens do Pedido</CardTitle>
          </CardHeader>
          <CardContent>
            {jerseyOrders.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum item encontrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Modelo da camisa</th>
                      <th className="pb-2 pr-4 font-medium">Número</th>
                      <th className="pb-2 pr-4 font-medium">Tamanho</th>
                      <th className="pb-2 font-medium">Nome na camisa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jerseyOrders.map((jo) => (
                      <>
                        <tr key={jo.id} className="border-b last:border-0" data-testid={`row-jersey-${jo.id}`}>
                          <td className="py-2 pr-4">
                            <div className="flex items-center gap-2">
                              {jo.jerseyImageUrl && (
                                <img src={jo.jerseyImageUrl} alt={jo.jerseyName} className="w-10 h-10 object-contain rounded border" data-testid={`img-jersey-${jo.id}`} />
                              )}
                              <span className="font-medium" data-testid={`text-jersey-name-${jo.id}`}>{jo.jerseyName}</span>
                            </div>
                          </td>
                          <td className="py-2 pr-4 font-medium" data-testid={`text-number-${jo.id}`}>{jo.number}</td>
                          <td className="py-2 pr-4" data-testid={`text-size-${jo.id}`}>{jo.size}</td>
                          <td className="py-2" data-testid={`text-nickname-${jo.id}`}>{jo.nickname}</td>
                        </tr>
                        {jo.extraNumbers && jo.extraNumbers.map((extra, i) => (
                          <tr key={`${jo.id}-extra-${i}`} className="border-b last:border-0 text-muted-foreground">
                            <td className="py-2 pr-4 pl-12 text-xs">↳ Extra</td>
                            <td className="py-2 pr-4">{extra.number}</td>
                            <td className="py-2 pr-4">{extra.size || jo.size}</td>
                            <td className="py-2">{extra.nickname}</td>
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-3">
            <CreditCard className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="text-base">Pagamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(() => {
              const totalVal = parseFloat(order.totalAmount) || 0;
              const paidVal = parseFloat(order.paidAmount) || 0;
              const saldo = totalVal - paidVal;
              return (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <span className="text-muted-foreground">Status</span>
                      <p className="font-medium" data-testid="text-payment-status">{STATUS_LABELS[order.paymentStatus] || order.paymentStatus}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Valor Total</span>
                      <p className="font-semibold" data-testid="text-payment-amount">
                        R$ {totalVal.toFixed(2).replace(".", ",")}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Data</span>
                      <p data-testid="text-payment-date">
                        {order.createdAt ? new Date(order.createdAt).toLocaleDateString("pt-BR") : "-"}
                      </p>
                    </div>
                  </div>
                  {paidVal > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
                      <div>
                        <span className="text-muted-foreground">Valor Pago</span>
                        <p className="font-semibold text-emerald-600 dark:text-emerald-400" data-testid="text-paid-amount">
                          R$ {paidVal.toFixed(2).replace(".", ",")}
                        </p>
                      </div>
                      {saldo > 0.01 && (
                        <div>
                          <span className="text-muted-foreground">Saldo Pendente</span>
                          <p className="font-semibold text-orange-600 dark:text-orange-400" data-testid="text-balance-amount">
                            R$ {saldo.toFixed(2).replace(".", ",")}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  {!["PAID", "RECEIVED", "CONFIRMED", "CANCELLED", "CANCELLED_BY_ADMIN"].includes(order.paymentStatus) && order.asaasPaymentUrl && (
                    <Button
                      className="w-full"
                      onClick={() => window.open(order.asaasPaymentUrl!, "_blank")}
                      data-testid="button-pay-now"
                    >
                      <ExternalLink className="w-4 h-4 mr-1" />
                      {order.paymentStatus === "PAGAMENTO_PARCIAL" ? "Pagar Diferença" : "Pagar Agora"}
                    </Button>
                  )}
                  {["PAID", "RECEIVED", "CONFIRMED"].includes(order.paymentStatus) && (
                    <div className="text-center text-sm text-emerald-600 dark:text-emerald-400 font-medium py-2" data-testid="text-payment-confirmed">
                      Pagamento confirmado
                    </div>
                  )}
                </>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
