import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useRequireAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Form, Jersey, FormResponse, JerseyOrder, Order, NumberReservation } from "@shared/schema";
import { THEMES, AVAILABLE_NUMBERS } from "@shared/schema";
import {
  ArrowLeft, Edit, Copy, ExternalLink, Trash2, Download,
  Shirt, Users, Hash, FileSpreadsheet, FileText, ArrowUpDown, ListOrdered, Unlock
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  AWAITING_PAYMENT: "Aguardando",
  PAGAMENTO_PARCIAL: "Parcial",
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

type SortKey = "athleteName" | "jerseyName" | "number" | "size" | "createdAt";
type SortDir = "asc" | "desc";

export default function AdminFormDetail() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  useRequireAuth();
  const formId = Number(params.id);
  const [productionFilter, setProductionFilter] = useState("PAID");
  const [sortKey, setSortKey] = useState<SortKey>("athleteName");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female">("all");

  const { data: form, isLoading: formLoading } = useQuery<Form>({
    queryKey: [`/api/forms/${params.id}`],
  });

  const { data: jerseyList } = useQuery<Jersey[]>({
    queryKey: [`/api/forms/${params.id}/jerseys`],
  });

  const { data: responsesList } = useQuery<FormResponse[]>({
    queryKey: [`/api/forms/${params.id}/responses`],
  });

  const { data: ordersList } = useQuery<JerseyOrder[]>({
    queryKey: [`/api/forms/${params.id}/jersey-orders`],
  });

  const { data: paymentOrders } = useQuery<Order[]>({
    queryKey: [`/api/forms/${params.id}/payment-orders`],
  });

  const { data: takenNumbers } = useQuery<Array<{ number: string; athleteName: string; jerseyId: number; orderId?: number; createdAt?: string | null }>>({
    queryKey: [`/api/forms/${params.id}/numbers`],
  });

  const { data: reservations } = useQuery<NumberReservation[]>({
    queryKey: [`/api/forms/${params.id}/reservations`],
    refetchInterval: 15000,
  });

  const { data: numberSelections } = useQuery<Array<{
    athleteName: string; jerseyName: string; number: string; size: string; createdAt: string | null;
  }>>({
    queryKey: [`/api/forms/${params.id}/number-selections`],
  });

  const sortedSelections = useMemo(() => {
    if (!numberSelections) return [];
    return [...numberSelections].sort((a, b) => {
      let aVal = a[sortKey] || "";
      let bVal = b[sortKey] || "";
      if (sortKey === "createdAt") {
        aVal = aVal ? new Date(aVal).toISOString() : "";
        bVal = bVal ? new Date(bVal).toISOString() : "";
      }
      const cmp = String(aVal).localeCompare(String(bVal), "pt-BR", { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [numberSelections, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const deleteResponseMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/responses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/forms/${params.id}/responses`] });
      queryClient.invalidateQueries({ queryKey: [`/api/forms/${params.id}/jersey-orders`] });
      queryClient.invalidateQueries({ queryKey: [`/api/forms/${params.id}/payment-orders`] });
      queryClient.invalidateQueries({ queryKey: [`/api/forms/${params.id}/numbers`] });
      queryClient.invalidateQueries({ queryKey: [`/api/forms/${params.id}/reservations`] });
      toast({ title: "Resposta excluída" });
    },
  });

  const releaseNumberMutation = useMutation({
    mutationFn: async ({ jerseyId, gender, number }: { jerseyId: number; gender: string; number: string }) => {
      await apiRequest("DELETE", `/api/admin/release-number/${jerseyId}/${encodeURIComponent(gender)}/${encodeURIComponent(number)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/forms/${params.id}/numbers`] });
      queryClient.invalidateQueries({ queryKey: [`/api/forms/${params.id}/reservations`] });
      queryClient.invalidateQueries({ queryKey: [`/api/forms/${params.id}/responses`] });
      queryClient.invalidateQueries({ queryKey: [`/api/forms/${params.id}/jersey-orders`] });
      queryClient.invalidateQueries({ queryKey: [`/api/forms/${params.id}/payment-orders`] });
      queryClient.invalidateQueries({ queryKey: [`/api/forms/${params.id}/number-selections`] });
      toast({ title: "Número liberado com sucesso. O pedido foi cancelado automaticamente." });
    },
    onError: () => {
      toast({ title: "Erro ao liberar número.", variant: "destructive" });
    },
  });

  const changeGenderMutation = useMutation({
    mutationFn: async ({ responseId, gender }: { responseId: number; gender: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/responses/${responseId}/gender`, { gender });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/forms/${params.id}/numbers`] });
      queryClient.invalidateQueries({ queryKey: [`/api/forms/${params.id}/reservations`] });
      queryClient.invalidateQueries({ queryKey: [`/api/forms/${params.id}/responses`] });
      queryClient.invalidateQueries({ queryKey: [`/api/forms/${params.id}/jersey-orders`] });
      queryClient.invalidateQueries({ queryKey: [`/api/forms/${params.id}/payment-orders`] });
      queryClient.invalidateQueries({ queryKey: [`/api/forms/${params.id}/number-selections`] });
      toast({ title: data?.message || "Gênero alterado com sucesso." });
    },
    onError: (error: any) => {
      let msg = "Erro ao alterar gênero.";
      try {
        const errStr = error?.message || "";
        const jsonStart = errStr.indexOf("{");
        if (jsonStart >= 0) {
          const parsed = JSON.parse(errStr.slice(jsonStart));
          msg = parsed.message || msg;
        }
      } catch {}
      toast({ title: msg, variant: "destructive" });
    },
  });

  const wsRef = useRef<WebSocket | null>(null);
  useEffect(() => {
    if (!formId) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws?formId=${formId}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (["number_reserved", "number_released_by_admin", "number_released_by_user", "number_released", "number_confirmed", "number_removed_from_gender", "number_added_to_gender"].includes(data.type)) {
          queryClient.invalidateQueries({ queryKey: [`/api/forms/${params.id}/numbers`] });
          queryClient.invalidateQueries({ queryKey: [`/api/forms/${params.id}/reservations`] });
          queryClient.invalidateQueries({ queryKey: [`/api/forms/${params.id}/number-selections`] });
        }
      } catch {}
    };

    return () => {
      ws.close();
    };
  }, [formId]);

  const copyLink = () => {
    if (!form) return;
    const url = `${window.location.origin}/form/${form.shareId}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!" });
  };

  const exportCSV = () => {
    window.open(`/api/forms/${formId}/export?format=csv`, "_blank");
  };

  const exportPDF = () => {
    window.open(`/api/forms/${formId}/export?format=pdf`, "_blank");
  };

  const getThemeColor = (theme: string) => {
    return THEMES.find(t => t.value === theme)?.primary || "#2563eb";
  };

  const jerseyMap = new Map((jerseyList || []).map(j => [j.id, j]));
  const responseMap = new Map((responsesList || []).map(r => [r.id, r]));
  const paymentOrderMap = new Map((paymentOrders || []).map(o => [o.responseId, o]));

  const filteredProductionOrders = useMemo(() => {
    if (!ordersList) return [];
    return ordersList.filter(order => {
      if (productionFilter === "all") return true;
      const po = paymentOrderMap.get(order.responseId);
      if (productionFilter === "PAID") return po?.paymentStatus === "PAID";
      if (productionFilter === "pending") return !po || ["PENDING", "AWAITING_PAYMENT"].includes(po.paymentStatus);
      return true;
    });
  }, [ordersList, paymentOrders, productionFilter]);

  const genderLabel = (g: string) => {
    if (g === "male") return "Masculino";
    if (g === "female") return "Feminino";
    if (g === "unisex") return "Unissex";
    return g;
  };

  if (formLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Formulário não encontrado</p>
      </div>
    );
  }

  const themeColor = getThemeColor(form.theme);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-4 flex-wrap">
            <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-lg" data-testid="button-back">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {form.logoUrl ? (
                <img src={form.logoUrl} alt={form.teamName} className="w-11 h-11 rounded-xl object-cover shadow-sm" />
              ) : (
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: themeColor + "15" }}
                >
                  <Shirt className="w-5 h-5" style={{ color: themeColor }} />
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-xl font-semibold truncate tracking-tight" data-testid="text-form-name">{form.teamName}</h1>
                <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                  {form.deadline && (
                    <span>Prazo: {format(new Date(form.deadline), "dd MMM yyyy", { locale: ptBR })}</span>
                  )}
                  {form.deadline && new Date(form.deadline) < new Date() ? (
                    <Badge variant="destructive" className="text-xs rounded-full">Expirado</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs rounded-full bg-emerald-50 text-emerald-700 border-emerald-200">Ativo</Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Link href={`/admin/forms/${formId}/edit`}>
                <Button variant="secondary" size="sm" className="rounded-lg" data-testid="button-edit-form">
                  <Edit className="w-3.5 h-3.5 mr-1.5" />
                  Editar
                </Button>
              </Link>
              <Button variant="secondary" size="sm" className="rounded-lg" onClick={copyLink} data-testid="button-copy-link">
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                Copiar Link
              </Button>
              <Link href={`/form/${form.shareId}`}>
                <Button variant="secondary" size="sm" className="rounded-lg" data-testid="button-preview">
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Visualizar
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { icon: Users, label: "Respostas", value: responsesList?.length || 0, testId: "text-response-count" },
            { icon: Shirt, label: "Camisetas", value: jerseyList?.length || 0, testId: "text-jersey-count" },
            { icon: Hash, label: "Números Escolhidos", value: takenNumbers?.length || 0, testId: "text-numbers-taken" },
            { icon: FileSpreadsheet, label: "Total de Pedidos", value: ordersList?.length || 0, testId: "text-order-count" },
          ].map((stat, i) => (
            <Card key={i} className="rounded-xl shadow-md">
              <CardContent className="pt-6 pb-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    <stat.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold tracking-tight" data-testid={stat.testId}>{stat.value}</p>
                    <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="responses" className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <TabsList className="rounded-lg">
              <TabsTrigger value="responses" className="rounded-md" data-testid="tab-responses">Respostas</TabsTrigger>
              <TabsTrigger value="numbers" className="rounded-md" data-testid="tab-numbers">Mapa de Números</TabsTrigger>
              <TabsTrigger value="selections" className="rounded-md" data-testid="tab-selections">Seleções de Números</TabsTrigger>
              <TabsTrigger value="production" className="rounded-md" data-testid="tab-production">Lista de Produção</TabsTrigger>
              <TabsTrigger value="jerseys" className="rounded-md" data-testid="tab-jerseys">Camisetas</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="secondary" size="sm" className="rounded-lg" onClick={exportCSV} data-testid="button-export-csv">
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Exportar CSV
              </Button>
              <Button size="sm" className="rounded-lg" onClick={exportPDF} data-testid="button-export-pdf">
                <FileText className="w-3.5 h-3.5 mr-1.5" />
                Exportar PDF
              </Button>
            </div>
          </div>

          <TabsContent value="responses">
            <Card className="rounded-xl shadow-md">
              <CardContent className="pt-6">
                {!responsesList || responsesList.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                      <Users className="w-8 h-8 text-muted-foreground/50" />
                    </div>
                    <p className="font-medium mb-1">Nenhuma resposta ainda</p>
                    <p className="text-sm">Compartilhe o link do formulário com seu time.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>CPF</TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Gênero</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {responsesList.map(response => (
                          <TableRow key={response.id} data-testid={`row-response-${response.id}`}>
                            <TableCell className="font-medium">{response.athleteName}</TableCell>
                            <TableCell className="font-mono text-sm">{response.cpf}</TableCell>
                            <TableCell>{response.phone}</TableCell>
                            <TableCell>
                              <Select
                                value={response.gender}
                                onValueChange={(newGender) => {
                                  if (newGender !== response.gender) {
                                    if (confirm("Alterar o gênero atualizará automaticamente os mapas de números e os pedidos associados. Deseja continuar?")) {
                                      changeGenderMutation.mutate({ responseId: response.id, gender: newGender });
                                    }
                                  }
                                }}
                              >
                                <SelectTrigger className="w-[130px] h-8 text-sm rounded-lg" data-testid={`select-gender-${response.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="male">Masculino</SelectItem>
                                  <SelectItem value="female">Feminino</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              {response.createdAt && format(new Date(response.createdAt), "dd MMM yyyy", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-right">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-lg text-muted-foreground hover:text-destructive"
                                    data-testid={`button-delete-response-${response.id}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-xl">
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir Resposta</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Excluir a resposta de {response.athleteName}? Os números escolhidos serão liberados.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel className="rounded-lg">Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteResponseMutation.mutate(response.id)}
                                      className="rounded-lg"
                                    >
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
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

          <TabsContent value="numbers">
            <div className="space-y-6">
              <div className="flex items-center gap-2" data-testid="gender-filter-buttons">
                <Button
                  variant={genderFilter === "all" ? "default" : "outline"}
                  size="sm"
                  className="rounded-lg"
                  onClick={() => setGenderFilter("all")}
                  data-testid="button-filter-all"
                >
                  Todos
                </Button>
                <Button
                  variant={genderFilter === "male" ? "default" : "outline"}
                  size="sm"
                  className="rounded-lg"
                  onClick={() => setGenderFilter("male")}
                  data-testid="button-filter-male"
                >
                  Masculino
                </Button>
                <Button
                  variant={genderFilter === "female" ? "default" : "outline"}
                  size="sm"
                  className="rounded-lg"
                  onClick={() => setGenderFilter("female")}
                  data-testid="button-filter-female"
                >
                  Feminino
                </Button>
              </div>

              {(() => {
                const genders: Array<"male" | "female"> = genderFilter === "all" ? ["male", "female"] : [genderFilter];
                let mapCounter = 0;
                return genders.flatMap(g =>
                  (jerseyList || []).map(jersey => {
                    mapCounter++;
                    const genderLabel = g === "male" ? "Masculino" : "Feminino";
                    const jerseyTaken = (takenNumbers || []).filter(t => t.jerseyId === jersey.id && t.gender === g);
                    const jerseyReservations = (reservations || []).filter(r => r.jerseyId === jersey.id && (r as any).gender === g);
                    const takenMap = new Map(jerseyTaken.map(t => [t.number, t]));
                    const reservedMap = new Map(jerseyReservations.map(r => [r.number, r]));

                    const numberSet = new Set<string>(AVAILABLE_NUMBERS);
                    if (jersey.allowedNumbers) {
                      const parts = jersey.allowedNumbers.split(",").map((p: string) => p.trim()).filter(Boolean);
                      for (const part of parts) {
                        const rangeMatch = part.match(/^(\d+)\s*[-–]\s*(\d+)$/);
                        if (rangeMatch) {
                          const start = parseInt(rangeMatch[1]);
                          const end = parseInt(rangeMatch[2]);
                          for (let i = start; i <= end; i++) {
                            numberSet.add(String(i).padStart(2, "0"));
                          }
                        } else {
                          numberSet.add(part.padStart(2, "0"));
                        }
                      }
                    }
                    for (const t of jerseyTaken) numberSet.add(t.number);
                    for (const r of jerseyReservations) numberSet.add(r.number);
                    const allNumbers = Array.from(numberSet).sort((a, b) => parseInt(a) - parseInt(b));

                    return (
                      <Card key={`${jersey.id}-${g}`} className="rounded-xl shadow-md" data-testid={`number-map-jersey-${jersey.id}-${g}`}>
                        <CardHeader>
                          <div className="flex items-center gap-4">
                            {jersey.imageUrl && (
                              <img
                                src={jersey.imageUrl}
                                alt={jersey.name}
                                className="w-14 h-14 rounded-xl object-cover border shadow-sm"
                              />
                            )}
                            <div>
                              <CardTitle className="text-lg">
                                Mapa {String(mapCounter).padStart(2, "0")} - {jersey.name} ({genderLabel})
                              </CardTitle>
                              <p className="text-sm text-muted-foreground">
                                Números disponíveis, reservados e confirmados
                              </p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-5 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-10 gap-3">
                            {allNumbers.map(num => {
                              const taken = takenMap.get(num);
                              const reserved = reservedMap.get(num);
                              const isTaken = !!taken;
                              const isReserved = !isTaken && !!reserved;

                              let cellClass = "bg-emerald-50 border-emerald-300 text-emerald-700";
                              if (isTaken) cellClass = "bg-red-50 border-red-300 text-red-700";
                              else if (isReserved) cellClass = "bg-amber-50 border-amber-300 text-amber-700";

                              const tooltipLines: string[] = [];
                              if (isTaken && taken) {
                                tooltipLines.push(`Jogador: ${taken.athleteName}`);
                                if (taken.orderId) tooltipLines.push(`Pedido #${taken.orderId}`);
                                if (taken.createdAt) tooltipLines.push(`Data: ${format(new Date(taken.createdAt), "dd MMM yyyy HH:mm", { locale: ptBR })}`);
                              } else if (isReserved && reserved) {
                                tooltipLines.push(`Reservado por: ${reserved.reservedByName}`);
                                tooltipLines.push(`Expira: ${format(new Date(reserved.expiresAt), "HH:mm:ss", { locale: ptBR })}`);
                              } else {
                                tooltipLines.push(`Número ${num} disponível`);
                              }

                              const canRelease = isTaken || isReserved;

                              return (
                                <Tooltip key={num}>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={`relative aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-medium border-2 transition-all cursor-default shadow-sm ${cellClass}`}
                                      data-testid={`number-cell-${jersey.id}-${g}-${num}`}
                                    >
                                      <span className="text-lg font-bold leading-none">{num}</span>
                                      {isTaken && taken ? (
                                        <span className="text-[9px] font-medium truncate max-w-full px-1 text-center leading-tight mt-0.5 opacity-80">
                                          {taken.athleteName}
                                        </span>
                                      ) : isReserved && reserved ? (
                                        <span className="text-[9px] font-medium truncate max-w-full px-1 text-center leading-tight mt-0.5 opacity-80">
                                          {reserved.reservedByName}
                                        </span>
                                      ) : (
                                        <span className="text-[9px] font-medium opacity-60 mt-0.5">Disponível</span>
                                      )}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <div className="space-y-0.5 text-xs">
                                      {tooltipLines.map((line, i) => (
                                        <p key={i}>{line}</p>
                                      ))}
                                      {canRelease && (
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <button
                                              type="button"
                                              className="mt-1 flex items-center gap-1 text-xs text-destructive hover:underline"
                                              data-testid={`button-release-${jersey.id}-${g}-${num}`}
                                            >
                                              <Unlock className="w-3 h-3" />
                                              Liberar número
                                            </button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent className="rounded-xl" onClick={e => e.stopPropagation()}>
                                            <AlertDialogHeader>
                                              <AlertDialogTitle>Liberar Número {num} ({genderLabel})</AlertDialogTitle>
                                              <AlertDialogDescription>
                                                Esta ação irá cancelar o pedido do atleta que escolheu este número. Deseja continuar?
                                              </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                              <AlertDialogCancel className="rounded-lg">Cancelar</AlertDialogCancel>
                                              <AlertDialogAction
                                                className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                onClick={(e) => {
                                                  e.preventDefault();
                                                  releaseNumberMutation.mutate({ jerseyId: jersey.id, gender: g, number: num });
                                                }}
                                              >
                                                {releaseNumberMutation.isPending ? "Liberando..." : "Confirmar liberação"}
                                              </AlertDialogAction>
                                            </AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                );
              })()}
              <div className="flex items-center gap-6 px-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-emerald-50 border-2 border-emerald-300" />
                  <span>Disponível</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-amber-50 border-2 border-amber-300" />
                  <span>Reservado</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-50 border-2 border-red-300" />
                  <span>Confirmado</span>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="selections">
            <Card className="rounded-xl shadow-md">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ListOrdered className="w-5 h-5" />
                  Seleções de Números
                </CardTitle>
                <p className="text-sm text-muted-foreground">Tabela detalhada de todos os números escolhidos</p>
              </CardHeader>
              <CardContent>
                {!sortedSelections || sortedSelections.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                      <Hash className="w-8 h-8 text-muted-foreground/50" />
                    </div>
                    <p className="font-medium mb-1">Nenhum número selecionado</p>
                    <p className="text-sm">Os números aparecerão quando os jogadores escolherem.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {([
                            ["athleteName", "Atleta"],
                            ["jerseyName", "Camiseta"],
                            ["number", "Número"],
                            ["size", "Tamanho"],
                            ["createdAt", "Data da escolha"],
                          ] as [SortKey, string][]).map(([key, label]) => (
                            <TableHead key={key}>
                              <button
                                type="button"
                                className="flex items-center gap-1 hover:text-foreground transition-colors"
                                onClick={() => toggleSort(key)}
                                data-testid={`sort-${key}`}
                              >
                                {label}
                                <ArrowUpDown className={`w-3.5 h-3.5 ${sortKey === key ? "text-primary" : "opacity-40"}`} />
                              </button>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedSelections.map((sel, idx) => (
                          <TableRow key={idx} data-testid={`row-selection-${idx}`}>
                            <TableCell className="font-medium">{sel.athleteName}</TableCell>
                            <TableCell>{sel.jerseyName}</TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="rounded-full font-mono">{sel.number}</Badge>
                            </TableCell>
                            <TableCell>{sel.size}</TableCell>
                            <TableCell>
                              {sel.createdAt ? format(new Date(sel.createdAt), "dd MMM yyyy HH:mm", { locale: ptBR }) : "-"}
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

          <TabsContent value="production">
            <Card className="rounded-xl shadow-md">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Lista de Produção</CardTitle>
                  <Select value={productionFilter} onValueChange={setProductionFilter}>
                    <SelectTrigger className="w-[180px] rounded-lg" data-testid="select-production-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos pedidos</SelectItem>
                      <SelectItem value="PAID">Pagos</SelectItem>
                      <SelectItem value="pending">Pendentes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {!ordersList || ordersList.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                      <FileSpreadsheet className="w-8 h-8 text-muted-foreground/50" />
                    </div>
                    <p className="font-medium mb-1">Nenhum pedido ainda</p>
                    <p className="text-sm">Os pedidos aparecerão quando os jogadores responderem.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Modelo da Camisa</TableHead>
                          <TableHead>Número</TableHead>
                          <TableHead>Tamanho</TableHead>
                          <TableHead>Apelido</TableHead>
                          <TableHead>Pagamento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredProductionOrders.flatMap(order => {
                          const jersey = jerseyMap.get(order.jerseyId);
                          const response = responseMap.get(order.responseId);
                          const athleteName = response?.athleteName || "Desconhecido";
                          const jerseyName = jersey?.name || "Desconhecido";
                          const payOrder = paymentOrderMap.get(order.responseId);
                          const payStatus = payOrder?.paymentStatus || "PENDING";
                          const rows = [
                            { id: `${order.id}-main`, number: order.number, size: order.size, nickname: order.nickname },
                          ];
                          if (order.extraNumbers) {
                            (order.extraNumbers as Array<{ number: string; nickname: string; size?: string }>).forEach((extra, i) => {
                              rows.push({
                                id: `${order.id}-extra-${i}`,
                                number: extra.number,
                                size: extra.size || order.size,
                                nickname: extra.nickname,
                              });
                            });
                          }
                          return rows.map((row, ri) => (
                            <TableRow key={row.id} data-testid={`row-order-${row.id}`}>
                              <TableCell className="font-medium">{athleteName}</TableCell>
                              <TableCell>{jerseyName}</TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="rounded-full font-mono">{row.number}</Badge>
                              </TableCell>
                              <TableCell>{row.size}</TableCell>
                              <TableCell>{row.nickname}</TableCell>
                              <TableCell>
                                {ri === 0 && (
                                  <Badge className={`rounded-full text-xs ${STATUS_COLORS[payStatus] || ""}`}>
                                    {STATUS_LABELS[payStatus] || payStatus}
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ));
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jerseys">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {jerseyList?.map(jersey => (
                <Card key={jersey.id} className="rounded-xl shadow-md" data-testid={`card-jersey-${jersey.id}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      {jersey.imageUrl ? (
                        <img src={jersey.imageUrl} alt={jersey.name} className="w-20 h-20 rounded-xl object-cover shadow-sm" />
                      ) : (
                        <div className="w-20 h-20 rounded-xl bg-muted/50 flex items-center justify-center">
                          <Shirt className="w-8 h-8 text-muted-foreground/50" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{jersey.name}</h3>
                        <p className="text-sm text-muted-foreground">{jersey.modelType}</p>
                        <p className="text-sm text-muted-foreground">{genderLabel(jersey.genderType)}</p>
                        {jersey.price && jersey.price !== "0" && (
                          <Badge variant="secondary" className="mt-2 rounded-full font-medium">R$ {jersey.price}</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
