import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRequireAuth } from "@/lib/auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Download, FileText, BarChart3, Eye } from "lucide-react";
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

export default function AdminReports() {
  const { isLoading: authLoading } = useRequireAuth();
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: allOrders, isLoading } = useQuery<Order[]>({
    queryKey: ["/api/admin/all-orders"],
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-6xl mx-auto space-y-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const filteredOrders = allOrders?.filter(o =>
    statusFilter === "all" || o.paymentStatus === statusFilter
  ) || [];

  const totalPaid = allOrders?.filter(o => o.paymentStatus === "PAID").reduce((sum, o) => sum + (parseFloat(o.totalAmount) || 0), 0) || 0;
  const totalPending = allOrders?.filter(o => ["PENDING", "AWAITING_PAYMENT"].includes(o.paymentStatus)).reduce((sum, o) => sum + (parseFloat(o.totalAmount) || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-lg" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Relatório de Pagamentos</h1>
              <p className="text-sm text-muted-foreground">Acompanhe todos os pagamentos do sistema</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="rounded-lg"
              onClick={() => window.open("/api/admin/financial-report/export?format=csv", "_blank")}
              data-testid="button-export-csv"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              CSV
            </Button>
            <Button
              size="sm"
              className="rounded-lg"
              onClick={() => window.open("/api/admin/financial-report/export?format=pdf", "_blank")}
              data-testid="button-export-pdf"
            >
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              PDF
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="rounded-xl shadow-md">
            <CardContent className="pt-5 pb-4">
              <p className="text-sm text-muted-foreground">Total de Pedidos</p>
              <p className="text-2xl font-bold mt-1" data-testid="text-total-orders">{allOrders?.length || 0}</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-md">
            <CardContent className="pt-5 pb-4">
              <p className="text-sm text-muted-foreground">Total Recebido</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1" data-testid="text-total-paid">
                R$ {totalPaid.toFixed(2).replace(".", ",")}
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-xl shadow-md">
            <CardContent className="pt-5 pb-4">
              <p className="text-sm text-muted-foreground">Total Pendente</p>
              <p className="text-2xl font-bold text-amber-600 mt-1" data-testid="text-total-pending">
                R$ {totalPending.toFixed(2).replace(".", ",")}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-xl shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Pagamentos</CardTitle>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px] rounded-lg" data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="PAID">Pagos</SelectItem>
                  <SelectItem value="PENDING">Pendentes</SelectItem>
                  <SelectItem value="AWAITING_PAYMENT">Aguardando Pagamento</SelectItem>
                  <SelectItem value="OVERDUE">Vencidos</SelectItem>
                  <SelectItem value="CANCELLED">Cancelados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p className="font-medium">Nenhum pedido encontrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Atleta</TableHead>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map(order => (
                      <TableRow key={order.id} data-testid={`row-report-${order.id}`}>
                        <TableCell className="font-medium">{order.customerName}</TableCell>
                        <TableCell>#{order.id}</TableCell>
                        <TableCell>R$ {parseFloat(order.totalAmount).toFixed(2).replace(".", ",")}</TableCell>
                        <TableCell>
                          <Badge className={`rounded-full ${STATUS_COLORS[order.paymentStatus] || ""}`}>
                            {STATUS_LABELS[order.paymentStatus] || order.paymentStatus}
                          </Badge>
                        </TableCell>
                        <TableCell>{order.createdAt ? new Date(order.createdAt).toLocaleDateString("pt-BR") : "-"}</TableCell>
                        <TableCell>
                          <Link href={`/admin/orders/${order.id}`}>
                            <Button variant="ghost" size="sm" className="rounded-lg" data-testid={`button-view-order-${order.id}`}>
                              <Eye className="w-3.5 h-3.5 mr-1.5" />
                              Ver detalhes
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
