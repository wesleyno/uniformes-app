import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useRequireAuth } from "@/lib/auth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Shirt, ArrowLeft, Plus, Pencil, Trash2, Users, ShieldCheck,
  BarChart3, CreditCard, Settings, ClipboardList
} from "lucide-react";

interface SubAdmin {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  workspaceId: number;
  workspaceName: string;
  createdAt: string;
  permissions: {
    canManageForms: boolean;
    canManageCustomers: boolean;
    canViewReports: boolean;
    canManagePayments: boolean;
    canConfigureAsaas: boolean;
  };
}

const PERMISSION_LABELS = [
  { key: "canManageForms", label: "Gerenciar Formulários", icon: ClipboardList },
  { key: "canManageCustomers", label: "Gerenciar Clientes", icon: Users },
  { key: "canViewReports", label: "Ver Relatórios", icon: BarChart3 },
  { key: "canManagePayments", label: "Gerenciar Pagamentos", icon: CreditCard },
  { key: "canConfigureAsaas", label: "Configurar Asaas", icon: Settings },
] as const;

const defaultPermissions = {
  canManageForms: true,
  canManageCustomers: true,
  canViewReports: true,
  canManagePayments: true,
  canConfigureAsaas: true,
};

export default function AdminSubAdmins() {
  const { toast } = useToast();
  const { isSuperAdmin, isLoading: authLoading } = useRequireAuth();
  const [, navigate] = useLocation();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSubAdmin, setEditingSubAdmin] = useState<SubAdmin | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    workspaceName: "",
    permissions: { ...defaultPermissions },
  });

  const { data: subAdmins, isLoading } = useQuery<SubAdmin[]>({
    queryKey: ["/api/admin/sub-admins"],
    enabled: !authLoading && isSuperAdmin,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      return apiRequest("POST", "/api/admin/sub-admins", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sub-admins"] });
      toast({ title: "Sub-admin criado com sucesso!" });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (e: any) => {
      toast({ title: "Erro ao criar sub-admin", description: e.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      return apiRequest("PATCH", `/api/admin/sub-admins/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sub-admins"] });
      toast({ title: "Sub-admin atualizado com sucesso!" });
      setEditingSubAdmin(null);
    },
    onError: (e: any) => {
      toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/admin/sub-admins/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sub-admins"] });
      toast({ title: "Sub-admin removido com sucesso!" });
    },
    onError: (e: any) => {
      toast({ title: "Erro ao remover", description: e.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      return apiRequest("PATCH", `/api/admin/sub-admins/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sub-admins"] });
    },
  });

  const resetForm = () => {
    setForm({ name: "", email: "", password: "", workspaceName: "", permissions: { ...defaultPermissions } });
  };

  const openEdit = (sa: SubAdmin) => {
    setEditingSubAdmin(sa);
    setForm({
      name: sa.name,
      email: sa.email,
      password: "",
      workspaceName: sa.workspaceName,
      permissions: { ...sa.permissions },
    });
  };

  if (authLoading) return null;

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Acesso restrito ao administrador principal.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md">
              <Shirt className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">NTeamKit</h1>
              <p className="text-sm text-muted-foreground">Gerenciar Sub-Admins</p>
            </div>
          </div>
          <Link href="/">
            <Button variant="ghost" size="sm" className="rounded-lg">
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              Voltar ao Painel
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Sub-Admins</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Crie e gerencie usuários com acesso ao sistema. Cada sub-admin tem seu próprio workspace isolado.
            </p>
          </div>
          <Button onClick={() => { resetForm(); setShowCreateDialog(true); }} className="rounded-lg">
            <Plus className="w-4 h-4 mr-2" />
            Novo Sub-Admin
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : !subAdmins || subAdmins.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <ShieldCheck className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground">Nenhum sub-admin criado ainda.</p>
              <p className="text-sm text-muted-foreground mt-1">Clique em "Novo Sub-Admin" para começar.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {subAdmins.map((sa) => (
              <Card key={sa.id} className="border">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-base">{sa.name}</span>
                        <Badge variant={sa.isActive ? "default" : "secondary"}>
                          {sa.isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{sa.email}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Workspace: <span className="font-medium text-foreground">{sa.workspaceName}</span></p>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {PERMISSION_LABELS.map(({ key, label }) => (
                          <Badge
                            key={key}
                            variant={sa.permissions[key] ? "outline" : "secondary"}
                            className={`text-xs ${!sa.permissions[key] ? "opacity-40 line-through" : ""}`}
                          >
                            {label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 mr-2">
                        <span className="text-xs text-muted-foreground">{sa.isActive ? "Ativo" : "Inativo"}</span>
                        <Switch
                          checked={sa.isActive}
                          onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: sa.id, isActive: checked })}
                        />
                      </div>
                      <Button variant="outline" size="sm" className="rounded-lg" onClick={() => openEdit(sa)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="rounded-lg text-destructive hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover Sub-Admin</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja remover <strong>{sa.name}</strong>? Todos os dados do workspace dele serão excluídos permanentemente.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(sa.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Dialog Criar / Editar */}
      <Dialog open={showCreateDialog || !!editingSubAdmin} onOpenChange={(open) => {
        if (!open) { setShowCreateDialog(false); setEditingSubAdmin(null); }
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSubAdmin ? "Editar Sub-Admin" : "Novo Sub-Admin"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome completo</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: João Silva"
                className="mt-1"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@exemplo.com"
                className="mt-1"
                disabled={!!editingSubAdmin}
              />
            </div>
            <div>
              <Label>{editingSubAdmin ? "Nova senha (deixe em branco para manter)" : "Senha"}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder={editingSubAdmin ? "••••••••" : "Mínimo 6 caracteres"}
                className="mt-1"
              />
            </div>
            {!editingSubAdmin && (
              <div>
                <Label>Nome do Workspace</Label>
                <Input
                  value={form.workspaceName}
                  onChange={(e) => setForm(f => ({ ...f, workspaceName: e.target.value }))}
                  placeholder="Ex: Time do João"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Identificador do espaço de trabalho deste usuário.</p>
              </div>
            )}

            <div>
              <Label className="mb-2 block">Permissões</Label>
              <div className="space-y-3 border rounded-lg p-3">
                {PERMISSION_LABELS.map(({ key, label, icon: Icon }) => (
                  <div key={key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{label}</span>
                    </div>
                    <Switch
                      checked={form.permissions[key]}
                      onCheckedChange={(checked) =>
                        setForm(f => ({ ...f, permissions: { ...f.permissions, [key]: checked } }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); setEditingSubAdmin(null); }}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (editingSubAdmin) {
                  const data: any = { name: form.name, permissions: form.permissions };
                  if (form.password) data.password = form.password;
                  updateMutation.mutate({ id: editingSubAdmin.id, data });
                } else {
                  createMutation.mutate(form);
                }
              }}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingSubAdmin ? "Salvar alterações" : "Criar Sub-Admin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
