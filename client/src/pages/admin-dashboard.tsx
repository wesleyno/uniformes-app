import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useRequireAuth } from "@/lib/auth";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { Form } from "@shared/schema";
import { THEMES } from "@shared/schema";
import {
  Plus, ClipboardList, Users, Calendar, Trash2, ExternalLink, Copy, Shirt,
  Settings, BarChart3, LogOut, FileText, ShieldCheck, CreditCard
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AdminDashboard() {
  const { toast } = useToast();
  const { isLoading: authLoading, admin, isSuperAdmin } = useRequireAuth();

  const { data: forms, isLoading } = useQuery<Form[]>({
    queryKey: ["/api/forms"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/forms/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      toast({ title: "Formulário excluído com sucesso" });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/logout");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/me"] });
      window.location.href = "/admin/login";
    },
  });

  const copyLink = (shareId: string) => {
    const url = `${window.location.origin}/form/${shareId}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!" });
  };

  const getThemeColor = (theme: string) => {
    return THEMES.find(t => t.value === theme)?.primary || "#2563eb";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md">
              <Shirt className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight" data-testid="text-app-title">NTeamKit</h1>
              <p className="text-sm text-muted-foreground">Gestão de Uniformes Esportivos</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/admin/customers">
              <Button variant="ghost" size="sm" className="rounded-lg" data-testid="button-customers">
                <Users className="w-4 h-4 mr-1.5" />
                Clientes
              </Button>
            </Link>
            <Link href="/admin/reports">
              <Button variant="ghost" size="sm" className="rounded-lg" data-testid="button-reports">
                <BarChart3 className="w-4 h-4 mr-1.5" />
                Relatórios
              </Button>
            </Link>
            <Link href="/admin/settings">
              <Button variant="ghost" size="sm" className="rounded-lg" data-testid="button-settings">
                <Settings className="w-4 h-4 mr-1.5" />
                Configurações
              </Button>
            </Link>
            <Link href="/admin/docs">
              <Button variant="ghost" size="sm" className="rounded-lg" data-testid="button-docs">
                <FileText className="w-4 h-4 mr-1.5" />
                Documentação
              </Button>
            </Link>
            <Link href="/admin/subscriptions">
              <Button variant="ghost" size="sm" className="rounded-lg" data-testid="button-subscriptions">
                <CreditCard className="w-4 h-4 mr-1.5" />
                Assinaturas
              </Button>
            </Link>
            {isSuperAdmin && (
              <Link href="/admin/sub-admins">
                <Button variant="ghost" size="sm" className="rounded-lg" data-testid="button-sub-admins">
                  <ShieldCheck className="w-4 h-4 mr-1.5" />
                  Sub-Admins
                </Button>
              </Link>
            )}
            <Link href="/admin/forms/new">
              <Button className="rounded-lg shadow-sm" data-testid="button-create-form">
                <Plus className="w-4 h-4 mr-2" />
                Criar Formulário
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-lg text-muted-foreground"
              onClick={() => logoutMutation.mutate()}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Card key={i} className="rounded-xl shadow-md">
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-1/2 mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !forms || forms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
              <ClipboardList className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-semibold mb-2" data-testid="text-empty-state">Nenhum formulário criado</h2>
            <p className="text-muted-foreground mb-8 max-w-md">
              Crie seu primeiro formulário de uniforme para começar a receber as preferências dos jogadores.
            </p>
            <Link href="/admin/forms/new">
              <Button size="lg" className="rounded-lg shadow-sm" data-testid="button-create-first-form">
                <Plus className="w-4 h-4 mr-2" />
                Criar Primeiro Formulário
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {forms.map(form => (
              <Card
                key={form.id}
                className="group relative rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden"
                data-testid={`card-form-${form.id}`}
              >
                <div
                  className="h-1.5"
                  style={{ backgroundColor: getThemeColor(form.theme) }}
                />
                <CardHeader className="pb-3 pt-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      {form.logoUrl ? (
                        <img
                          src={form.logoUrl}
                          alt={form.teamName}
                          className="w-11 h-11 rounded-xl object-cover flex-shrink-0 shadow-sm"
                        />
                      ) : (
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: getThemeColor(form.theme) + "15" }}
                        >
                          <Shirt className="w-5 h-5" style={{ color: getThemeColor(form.theme) }} />
                        </div>
                      )}
                      <CardTitle className="text-lg truncate" data-testid={`text-team-name-${form.id}`}>
                        {form.teamName}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pb-5">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {form.deadline && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{format(new Date(form.deadline), "dd MMM yyyy", { locale: ptBR })}</span>
                      </div>
                    )}
                    {form.deadline && new Date(form.deadline) < new Date() ? (
                      <Badge variant="destructive" className="text-xs rounded-full">Expirado</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs rounded-full bg-emerald-50 text-emerald-700 border-emerald-200">Ativo</Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <Link href={`/admin/forms/${form.id}`}>
                      <Button variant="secondary" size="sm" className="rounded-lg" data-testid={`button-view-form-${form.id}`}>
                        <Users className="w-3.5 h-3.5 mr-1.5" />
                        Ver Detalhes
                      </Button>
                    </Link>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="rounded-lg"
                      onClick={() => copyLink(form.shareId)}
                      data-testid={`button-copy-link-${form.id}`}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1.5" />
                      Copiar Link
                    </Button>
                    <Link href={`/form/${form.shareId}`}>
                      <Button variant="secondary" size="sm" className="rounded-lg" data-testid={`button-preview-${form.id}`}>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="secondary" size="sm" className="rounded-lg" data-testid={`button-delete-form-${form.id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir Formulário</AlertDialogTitle>
                          <AlertDialogDescription>
                            Isso excluirá permanentemente "{form.teamName}" e todas as respostas. Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-lg">Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(form.id)}
                            className="rounded-lg"
                            data-testid="button-confirm-delete"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
