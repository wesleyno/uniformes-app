import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useRequireAuth } from "@/lib/auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { Customer, Order, CustomerAuditLog } from "@shared/schema";
import { Textarea } from "@/components/ui/textarea";
import {
  Shirt, Users, ArrowLeft, Search, Pencil, History, ShoppingBag,
  Phone, CreditCard, Clock, X, Save, Plus, StickyNote
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function formatJsonValue(val: unknown): string {
  if (!val || typeof val !== "object") return "";
  return Object.entries(val as Record<string, unknown>)
    .map(([k, v]) => k + ": " + String(v))
    .join(", ");
}

function formatCpf(cpf: string) {
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "PAID":
      return <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">Pago</Badge>;
    case "AWAITING_PAYMENT":
      return <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">Aguardando</Badge>;
    case "OVERDUE":
      return <Badge variant="destructive">Vencido</Badge>;
    case "CANCELLED":
      return <Badge variant="secondary" className="bg-gray-50 text-gray-500 border-gray-200">Cancelado</Badge>;
    default:
      return <Badge variant="secondary">Pendente</Badge>;
  }
}

export default function AdminCustomers() {
  const { toast } = useToast();
  const { isLoading: authLoading } = useRequireAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCpf, setNewCpf] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const { data: customerOrders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/customers", selectedCustomer?.id, "orders"],
    enabled: !!selectedCustomer,
  });

  const { data: auditLogs, isLoading: auditLoading } = useQuery<CustomerAuditLog[]>({
    queryKey: ["/api/customers", selectedCustomer?.id, "audit-log"],
    enabled: !!selectedCustomer,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name, phone, notes }: { id: number; name: string; phone: string; notes: string }) => {
      await apiRequest("PATCH", `/api/customers/${id}`, { name, phone, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      if (selectedCustomer) {
        queryClient.invalidateQueries({ queryKey: ["/api/customers", selectedCustomer.id, "audit-log"] });
      }
      setEditingCustomer(null);
      toast({ title: "Cliente atualizado com sucesso" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar cliente", description: err.message, variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; cpf: string; phone: string; notes: string }) => {
      await apiRequest("POST", "/api/customers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setShowCreateDialog(false);
      setNewName("");
      setNewCpf("");
      setNewPhone("");
      setNewNotes("");
      toast({ title: "Cliente criado com sucesso" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao criar cliente", description: err.message, variant: "destructive" });
    },
  });

  const filtered = customers?.filter(c => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.name.toLowerCase().includes(term) ||
      c.cpf.includes(searchTerm.replace(/\D/g, "")) ||
      c.phone.includes(searchTerm.replace(/\D/g, ""))
    );
  });

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setEditName(customer.name);
    setEditPhone(formatPhone(customer.phone));
    setEditNotes(customer.notes || "");
  };

  const saveEdit = () => {
    if (!editingCustomer) return;
    updateMutation.mutate({
      id: editingCustomer.id,
      name: editName,
      phone: editPhone,
      notes: editNotes,
    });
  };

  function applyCpfMask(value: string) {
    const d = value.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }

  function applyPhoneMask(value: string) {
    const d = value.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d.length ? `(${d}` : "";
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d[2]} ${d.slice(3, 7)}-${d.slice(7)}`;
  }

  const saveNewCustomer = () => {
    const cpfDigits = newCpf.replace(/\D/g, "");
    if (!newName || cpfDigits.length !== 11 || !newPhone.replace(/\D/g, "")) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    createMutation.mutate({ name: newName, cpf: newCpf, phone: newPhone, notes: newNotes });
  };

  if (authLoading) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md">
              <Users className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight" data-testid="text-page-title">Clientes</h1>
              <p className="text-sm text-muted-foreground">Gestão de clientes cadastrados</p>
            </div>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} data-testid="button-new-customer">
            <Plus className="w-4 h-4 mr-1.5" />
            Novo cliente
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CPF ou telefone..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search-customers"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="rounded-xl">
                <CardContent className="p-4">
                  <Skeleton className="h-5 w-1/3 mb-2" />
                  <Skeleton className="h-4 w-1/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !filtered || filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
              <Users className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold mb-2" data-testid="text-empty-state">
              {searchTerm ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
            </h2>
            <p className="text-muted-foreground max-w-md">
              {searchTerm
                ? "Tente buscar com outros termos."
                : "Os clientes serão cadastrados automaticamente quando enviarem respostas nos formulários."}
            </p>
          </div>
        ) : (
          <Card className="rounded-xl shadow-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Cadastrado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(customer => (
                  <TableRow key={customer.id} data-testid={`row-customer-${customer.id}`}>
                    <TableCell className="font-medium" data-testid={`text-customer-name-${customer.id}`}>
                      {customer.name}
                    </TableCell>
                    <TableCell data-testid={`text-customer-cpf-${customer.id}`}>
                      {formatCpf(customer.cpf)}
                    </TableCell>
                    <TableCell data-testid={`text-customer-phone-${customer.id}`}>
                      {formatPhone(customer.phone)}
                    </TableCell>
                    <TableCell>
                      {customer.createdAt
                        ? format(new Date(customer.createdAt), "dd/MM/yyyy", { locale: ptBR })
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(customer)}
                          data-testid={`button-edit-customer-${customer.id}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedCustomer(customer)}
                          data-testid={`button-view-customer-${customer.id}`}
                        >
                          <ShoppingBag className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </main>

      <Dialog open={!!editingCustomer} onOpenChange={(open) => { if (!open) setEditingCustomer(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>CPF (somente leitura)</Label>
              <Input
                value={editingCustomer ? formatCpf(editingCustomer.cpf) : ""}
                disabled
                data-testid="input-edit-cpf"
              />
            </div>
            <div>
              <Label>Nome</Label>
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value.toUpperCase())}
                data-testid="input-edit-name"
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={editPhone}
                onChange={e => setEditPhone(e.target.value)}
                data-testid="input-edit-phone"
              />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                placeholder="Anotações sobre o cliente..."
                className="resize-none"
                rows={3}
                data-testid="input-edit-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingCustomer(null)} data-testid="button-cancel-edit">
              Cancelar
            </Button>
            <Button onClick={saveEdit} disabled={updateMutation.isPending} data-testid="button-save-edit">
              <Save className="w-4 h-4 mr-1.5" />
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) setShowCreateDialog(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome *</Label>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value.toUpperCase())}
                placeholder="Nome completo"
                data-testid="input-new-name"
              />
            </div>
            <div>
              <Label>CPF *</Label>
              <Input
                value={newCpf}
                onChange={e => setNewCpf(applyCpfMask(e.target.value))}
                placeholder="000.000.000-00"
                data-testid="input-new-cpf"
              />
            </div>
            <div>
              <Label>Telefone *</Label>
              <Input
                value={newPhone}
                onChange={e => setNewPhone(applyPhoneMask(e.target.value))}
                placeholder="(00) 0 0000-0000"
                data-testid="input-new-phone"
              />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={newNotes}
                onChange={e => setNewNotes(e.target.value)}
                placeholder="Anotações sobre o cliente..."
                className="resize-none"
                rows={3}
                data-testid="input-new-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel-create">
              Cancelar
            </Button>
            <Button onClick={saveNewCustomer} disabled={createMutation.isPending} data-testid="button-save-create">
              <Save className="w-4 h-4 mr-1.5" />
              {createMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedCustomer} onOpenChange={(open) => { if (!open) setSelectedCustomer(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              {selectedCustomer?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-2 text-sm text-muted-foreground mb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                <span data-testid="text-detail-cpf">{formatCpf(selectedCustomer.cpf)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4" />
                <span data-testid="text-detail-phone">{formatPhone(selectedCustomer.phone)}</span>
              </div>
              {selectedCustomer.notes && (
                <div className="flex items-start gap-2">
                  <StickyNote className="w-4 h-4 mt-0.5" />
                  <span data-testid="text-detail-notes">{selectedCustomer.notes}</span>
                </div>
              )}
            </div>
          )}

          <Tabs defaultValue="orders">
            <TabsList className="w-full">
              <TabsTrigger value="orders" className="flex-1" data-testid="tab-orders">
                <ShoppingBag className="w-4 h-4 mr-1.5" />
                Pedidos
              </TabsTrigger>
              <TabsTrigger value="audit" className="flex-1" data-testid="tab-audit">
                <History className="w-4 h-4 mr-1.5" />
                Histórico
              </TabsTrigger>
            </TabsList>

            <TabsContent value="orders" className="mt-4">
              {ordersLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : !customerOrders || customerOrders.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">Nenhum pedido encontrado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pedido</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerOrders.map(order => (
                      <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                        <TableCell className="font-medium">#{order.id}</TableCell>
                        <TableCell>R$ {parseFloat(order.totalAmount).toFixed(2).replace(".", ",")}</TableCell>
                        <TableCell>{getStatusBadge(order.paymentStatus)}</TableCell>
                        <TableCell>
                          {order.createdAt
                            ? format(new Date(order.createdAt), "dd/MM/yyyy", { locale: ptBR })
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Link href={`/admin/orders/${order.id}`}>
                            <Button variant="ghost" size="sm" data-testid={`button-view-order-${order.id}`}>
                              Ver
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="audit" className="mt-4">
              {auditLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : !auditLogs || auditLogs.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">Nenhum registro de auditoria.</p>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map(log => (
                    <Card key={log.id} className="rounded-lg" data-testid={`card-audit-${log.id}`}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                          <Badge variant="secondary" className="text-xs">
                            {log.action}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {log.createdAt
                              ? format(new Date(log.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })
                              : "-"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Por: {log.changedBy}
                        </p>
                        {log.oldValue ? (
                          <div className="mt-2 text-xs">
                            <span className="font-medium">Anterior: </span>
                            <span className="text-muted-foreground">
                              {formatJsonValue(log.oldValue)}
                            </span>
                          </div>
                        ) : null}
                        {log.newValue ? (
                          <div className="text-xs">
                            <span className="font-medium">Novo: </span>
                            <span className="text-muted-foreground">
                              {formatJsonValue(log.newValue)}
                            </span>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
