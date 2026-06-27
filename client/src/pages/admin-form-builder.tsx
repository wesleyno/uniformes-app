import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useRequireAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { Form, Jersey, FormSponsor } from "@shared/schema";
import { THEMES, AUDIENCE_TYPES } from "@shared/schema";
import { ArrowLeft, Plus, Trash2, Upload, Shirt, Save, Clock, Star, X, ExternalLink, GripVertical } from "lucide-react";
import { Link } from "wouter";

const AUDIENCE_LABELS: Record<string, string> = {
  adult: "Adulto",
  child: "Infantil",
  mixed: "Misto",
};

function formatWhatsapp(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 3) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function unformatWhatsapp(value: string): string {
  return value.replace(/\D/g, "");
}

function formatBRL(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 0) return "";
  const cents = parseInt(digits, 10);
  const reais = (cents / 100).toFixed(2);
  const [intPart, decPart] = reais.split(".");
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${formattedInt},${decPart}`;
}

function brlToDecimal(formatted: string): string {
  const digits = formatted.replace(/\D/g, "");
  if (digits.length === 0) return "0";
  const cents = parseInt(digits, 10);
  return (cents / 100).toFixed(2);
}

function decimalToBRL(decimal: string): string {
  const num = parseFloat(decimal);
  if (isNaN(num)) return "R$ 0,00";
  const cents = Math.round(num * 100).toString();
  return formatBRL(cents);
}

interface JerseyFormData {
  id?: number;
  name: string;
  price: string;
  modelType: string;
  genderType: string;
  audienceType: string;
  allowedNumbers: string;
  description: string;
  image?: File;
  imageUrl?: string | null;
  galleryFiles: File[];
  galleryPreviews: string[];
  existingGalleryImages: string[];
}

export default function AdminFormBuilder() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  useRequireAuth();
  const { toast } = useToast();
  const isEditing = Boolean(params.id);

  const [teamName, setTeamName] = useState("");
  const [theme, setTheme] = useState("blue");
  const [deadline, setDeadline] = useState("");
  const [numberRuleUnique, setNumberRuleUnique] = useState(true);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [jerseyForms, setJerseyForms] = useState<JerseyFormData[]>([]);
  const [deletedJerseyIds, setDeletedJerseyIds] = useState<number[]>([]);
  const [loaded, setLoaded] = useState(!isEditing);
  const [supportWhatsapp, setSupportWhatsapp] = useState("");
  const [reservationTimeValue, setReservationTimeValue] = useState("5");
  const [reservationTimeUnit, setReservationTimeUnit] = useState("minutes");
  const [sponsorDescription, setSponsorDescription] = useState("");
  const [sponsors, setSponsors] = useState<FormSponsor[]>([]);
  const [tryonEnabled, setTryonEnabled] = useState(false);
  const [sponsorCarouselEnabled, setSponsorCarouselEnabled] = useState(false);
  const [newSponsors, setNewSponsors] = useState<Array<{ file: File; preview: string; name: string; linkUrl: string; description: string; displayOrder: number }>>([]);
  const [sponsorFiles, setSponsorFiles] = useState<File[]>([]);
  const [sponsorPreviews, setSponsorPreviews] = useState<string[]>([]);

  const { data: formData } = useQuery<Form>({
    queryKey: ['/api/forms', params.id],
    enabled: isEditing && !!params.id,
  });

  const { data: jerseyData } = useQuery<Jersey[]>({
    queryKey: ['/api/forms', params.id, 'jerseys'],
    enabled: isEditing && loaded && !!params.id,
  });

  const { data: sponsorData } = useQuery<FormSponsor[]>({
    queryKey: ['/api/forms', params.id, 'sponsors'],
    enabled: isEditing && !!params.id,
  });

  useEffect(() => {
    if (formData && !loaded) {
      setTeamName(formData.teamName);
      setTheme(formData.theme);
      setDeadline(formData.deadline ? new Date(formData.deadline).toISOString().split("T")[0] : "");
      setNumberRuleUnique(formData.numberRuleUnique);
      setLogoPreview(formData.logoUrl);
      setSupportWhatsapp((formData as any).supportWhatsapp || "");
      setReservationTimeValue(String(formData.reservationTimeValue || 5));
      setReservationTimeUnit(formData.reservationTimeUnit || "minutes");
      setSponsorDescription(formData.sponsorDescription || "");
      setTryonEnabled(formData.tryonEnabled || false);
      setSponsorCarouselEnabled(formData.sponsorCarouselEnabled || false);
      setLoaded(true);
    }
  }, [formData, loaded]);

  useEffect(() => {
    if (sponsorData) {
      setSponsors(sponsorData);
    }
  }, [sponsorData]);

  useEffect(() => {
    if (jerseyData && jerseyForms.length === 0 && jerseyData.length > 0) {
      setJerseyForms(jerseyData.map((j: Jersey) => ({
        id: j.id,
        name: j.name,
        price: j.price,
        modelType: j.modelType,
        genderType: j.genderType,
        audienceType: j.audienceType || "adult",
        allowedNumbers: j.allowedNumbers || "",
        description: j.description || "",
        imageUrl: j.imageUrl,
        galleryFiles: [] as File[],
        galleryPreviews: [] as string[],
        existingGalleryImages: (j.galleryImages || []) as string[],
      })));
    }
  }, [jerseyData]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const addJersey = () => {
    setJerseyForms(prev => [...prev, {
      name: "",
      price: "0",
      modelType: "",
      genderType: "unisex",
      audienceType: "adult",
      allowedNumbers: "",
      description: "",
      galleryFiles: [],
      galleryPreviews: [],
      existingGalleryImages: [],
    }]);
  };

  const updateJersey = (index: number, field: string, value: any) => {
    setJerseyForms(prev => prev.map((j, i) => i === index ? { ...j, [field]: value } : j));
  };

  const removeJersey = (index: number) => {
    const jersey = jerseyForms[index];
    if (jersey.id) {
      setDeletedJerseyIds(prev => [...prev, jersey.id!]);
    }
    setJerseyForms(prev => prev.filter((_, i) => i !== index));
  };

  const handleJerseyImage = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      updateJersey(index, "image", file);
      updateJersey(index, "imageUrl", URL.createObjectURL(file));
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append("teamName", teamName);
      fd.append("theme", theme);
      if (deadline) fd.append("deadline", deadline);
      fd.append("numberRuleUnique", String(numberRuleUnique));
      if (supportWhatsapp) fd.append("supportWhatsapp", supportWhatsapp);
      fd.append("reservationTimeValue", reservationTimeValue);
      fd.append("reservationTimeUnit", reservationTimeUnit);
      fd.append("sponsorDescription", sponsorDescription || "");
      fd.append("tryonEnabled", String(tryonEnabled));
      fd.append("sponsorCarouselEnabled", String(sponsorCarouselEnabled));
      if (logoFile) fd.append("logo", logoFile);

      let formRes: Response;
      if (isEditing) {
        formRes = await fetch(`/api/forms/${params.id}`, { method: "PATCH", body: fd, credentials: "include" });
      } else {
        formRes = await fetch("/api/forms", { method: "POST", body: fd, credentials: "include" });
      }
      
      if (!formRes.ok) throw new Error("Failed to save form");
      const savedForm = await formRes.json();

      for (const deletedId of deletedJerseyIds) {
        await fetch(`/api/jerseys/${deletedId}`, { method: "DELETE", credentials: "include" });
      }

      const failedJerseys: string[] = [];
      for (const jersey of jerseyForms) {
        const jerseyData = new FormData();
        jerseyData.append("name", jersey.name);
        jerseyData.append("price", jersey.price);
        jerseyData.append("modelType", jersey.modelType);
        jerseyData.append("genderType", jersey.genderType);
        jerseyData.append("audienceType", jersey.audienceType);
        if (jersey.allowedNumbers) jerseyData.append("allowedNumbers", jersey.allowedNumbers);
        if (jersey.description) jerseyData.append("description", jersey.description);
        if (jersey.image) jerseyData.append("image", jersey.image);
        if (jersey.galleryFiles && jersey.galleryFiles.length > 0) {
          jersey.galleryFiles.forEach(f => jerseyData.append("galleryImages", f));
        }
        if (jersey.existingGalleryImages && jersey.existingGalleryImages.length > 0) {
          jerseyData.append("existingGalleryImages", JSON.stringify(jersey.existingGalleryImages));
        }

        let res: Response;
        if (jersey.id) {
          res = await fetch(`/api/jerseys/${jersey.id}`, { method: "PATCH", body: jerseyData, credentials: "include" });
        } else {
          res = await fetch(`/api/forms/${savedForm.id}/jerseys`, { method: "POST", body: jerseyData, credentials: "include" });
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: "Erro desconhecido" }));
          failedJerseys.push(`${jersey.name}: ${err.message}`);
        }
      }

      for (const ns of newSponsors) {
        const sponsorFd = new FormData();
        sponsorFd.append("logo", ns.file);
        sponsorFd.append("name", ns.name);
        sponsorFd.append("linkUrl", ns.linkUrl);
        sponsorFd.append("description", ns.description);
        sponsorFd.append("displayOrder", String(ns.displayOrder));
        await fetch(`/api/forms/${savedForm.id}/sponsors`, { method: "POST", body: sponsorFd, credentials: "include" });
      }

      for (const sponsor of sponsors) {
        if ((sponsor as any)._dirty) {
          const patchFd = new FormData();
          patchFd.append("name", sponsor.name);
          patchFd.append("linkUrl", sponsor.linkUrl || "");
          patchFd.append("description", sponsor.description || "");
          patchFd.append("displayOrder", String(sponsor.displayOrder));
          await fetch(`/api/sponsors/${sponsor.id}`, { method: "PATCH", body: patchFd, credentials: "include" });
        }
      }

      return { form: savedForm, failedJerseys };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/forms"] });
      queryClient.invalidateQueries({ queryKey: ["/api/forms", String(data.form.id), "sponsors"] });
      setNewSponsors([]);
      setSponsorFiles([]);
      setSponsorPreviews([]);
      if (data.failedJerseys.length > 0) {
        toast({
          title: "Formulário salvo, mas algumas camisetas falharam",
          description: data.failedJerseys.join(". ") + ". Tente usar imagens menores (máx 20MB).",
          variant: "destructive",
        });
      } else {
        toast({ title: isEditing ? "Formulário atualizado!" : "Formulário criado!" });
      }
      navigate(`/admin/forms/${data.form.id}`);
    },
    onError: () => {
      toast({ title: "Erro ao salvar formulário", variant: "destructive" });
    },
  });

  if (isEditing && !loaded) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center gap-4">
          <Link href={isEditing ? `/admin/forms/${params.id}` : "/"}>
            <Button variant="ghost" size="icon" className="rounded-lg" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-semibold tracking-tight" data-testid="text-page-title">
              {isEditing ? "Editar Formulário" : "Criar Novo Formulário"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEditing ? "Atualize as informações do formulário" : "Configure o formulário de uniformes do time"}
            </p>
          </div>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !teamName}
            className="rounded-lg shadow-sm"
            data-testid="button-save-form"
          >
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "Salvando..." : "Salvar Formulário"}
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <Card className="rounded-xl shadow-md">
          <CardHeader>
            <CardTitle className="text-lg">Informações do Time</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <Label htmlFor="teamName">Nome do Time *</Label>
                <Input
                  id="teamName"
                  value={teamName}
                  onChange={e => setTeamName(e.target.value)}
                  placeholder="Ex: FC Estrela"
                  className="rounded-lg"
                  data-testid="input-team-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="theme">Tema Visual</Label>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger className="rounded-lg" data-testid="select-theme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {THEMES.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.primary }} />
                          {t.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="deadline">Prazo Final</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  className="rounded-lg"
                  data-testid="input-deadline"
                />
              </div>
              <div className="space-y-2">
                <Label>Logo do Time</Label>
                <div className="flex items-center gap-4">
                  {logoPreview && (
                    <img src={logoPreview} alt="Logo" className="w-14 h-14 rounded-xl object-cover shadow-sm" />
                  )}
                  <label className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm text-muted-foreground hover:bg-muted/50 transition-colors">
                      <Upload className="w-4 h-4" />
                      {logoPreview ? "Alterar" : "Enviar Logo"}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoChange}
                      data-testid="input-logo"
                    />
                  </label>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 pt-2 p-4 bg-muted/30 rounded-lg">
              <Switch
                checked={numberRuleUnique}
                onCheckedChange={setNumberRuleUnique}
                data-testid="switch-unique-numbers"
              />
              <Label className="text-sm">Números únicos por formulário (jogadores não podem compartilhar números)</Label>
            </div>
            <div className="flex items-center gap-3 pt-2 p-4 bg-muted/30 rounded-lg">
              <Shirt className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={tryonEnabled}
                    onCheckedChange={setTryonEnabled}
                    data-testid="switch-tryon-enabled"
                  />
                  <Label className="text-sm">Try-On Virtual</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Permite que atletas enviem uma foto e visualizem como o uniforme ficará no corpo.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>WhatsApp de Suporte</Label>
              <Input
                value={formatWhatsapp(supportWhatsapp)}
                onChange={e => setSupportWhatsapp(unformatWhatsapp(e.target.value))}
                placeholder="(11) 9 9999-9999"
                className="rounded-lg"
                data-testid="input-support-whatsapp"
              />
              <p className="text-xs text-muted-foreground">
                DDD + número. Exibido como botão flutuante no formulário público.
              </p>
            </div>
            <div className="flex items-center gap-3 pt-2 p-4 bg-muted/30 rounded-lg">
              <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 space-y-1">
                <Label className="text-sm">Tempo de Reserva de Número</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    value={reservationTimeValue}
                    onChange={e => setReservationTimeValue(e.target.value)}
                    className="rounded-lg w-20"
                    data-testid="input-reservation-time-value"
                  />
                  <Select value={reservationTimeUnit} onValueChange={setReservationTimeUnit}>
                    <SelectTrigger className="rounded-lg w-36" data-testid="select-reservation-time-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seconds">Segundos</SelectItem>
                      <SelectItem value="minutes">Minutos</SelectItem>
                      <SelectItem value="hours">Horas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Tempo que um número fica reservado enquanto o jogador preenche o formulário.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-md">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="w-5 h-5" />
              Patrocinadores
            </CardTitle>
            <label className="cursor-pointer">
              <Button variant="secondary" size="sm" className="rounded-lg" asChild>
                <span>
                  <Plus className="w-4 h-4 mr-1.5" />
                  Adicionar Patrocinador
                </span>
              </Button>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const preview = URL.createObjectURL(file);
                    setNewSponsors(prev => [...prev, { file, preview, name: "", linkUrl: "", description: "", displayOrder: sponsors.length + prev.length }]);
                  }
                  e.target.value = "";
                }}
                data-testid="input-add-sponsor"
              />
            </label>
          </CardHeader>
          <CardContent className="space-y-4">
            {sponsors.map((sponsor, idx) => (
              <div key={sponsor.id} className="border rounded-lg p-3 space-y-3 bg-gray-50/50" data-testid={`card-sponsor-${sponsor.id}`}>
                <div className="flex items-start gap-3">
                  <label className="flex-shrink-0 cursor-pointer group/logo relative">
                    <img src={sponsor.logoUrl} alt={sponsor.name || "Patrocinador"} className="w-16 h-16 rounded-lg object-contain border p-1 bg-white" />
                    <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center opacity-0 group-hover/logo:opacity-100 transition-opacity">
                      <Upload className="w-4 h-4 text-white" />
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const fd = new FormData();
                          fd.append("logo", file);
                          fd.append("name", sponsor.name);
                          fd.append("linkUrl", sponsor.linkUrl || "");
                          fd.append("description", sponsor.description || "");
                          fd.append("displayOrder", String(sponsor.displayOrder));
                          const res = await fetch(`/api/sponsors/${sponsor.id}`, { method: "PATCH", body: fd, credentials: "include" });
                          if (res.ok) {
                            const updated = await res.json();
                            setSponsors(prev => prev.map(s => s.id === sponsor.id ? updated : s));
                          }
                        }
                        e.target.value = "";
                      }}
                      data-testid={`input-sponsor-logo-replace-${sponsor.id}`}
                    />
                  </label>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={sponsor.name}
                        onChange={e => setSponsors(prev => prev.map((s, i) => i === idx ? { ...s, name: e.target.value, _dirty: true } as any : s))}
                        placeholder="Nome do patrocinador"
                        className="rounded-lg text-sm"
                        data-testid={`input-sponsor-name-${sponsor.id}`}
                      />
                      <Input
                        type="number"
                        value={sponsor.displayOrder}
                        onChange={e => setSponsors(prev => prev.map((s, i) => i === idx ? { ...s, displayOrder: parseInt(e.target.value) || 0, _dirty: true } as any : s))}
                        className="rounded-lg text-sm w-20"
                        title="Ordem de exibição"
                        data-testid={`input-sponsor-order-${sponsor.id}`}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <Input
                        value={sponsor.linkUrl || ""}
                        onChange={e => setSponsors(prev => prev.map((s, i) => i === idx ? { ...s, linkUrl: e.target.value, _dirty: true } as any : s))}
                        placeholder="https://link-do-patrocinador.com"
                        className="rounded-lg text-sm"
                        data-testid={`input-sponsor-link-${sponsor.id}`}
                      />
                    </div>
                    <Input
                      value={sponsor.description || ""}
                      onChange={e => setSponsors(prev => prev.map((s, i) => i === idx ? { ...s, description: e.target.value, _dirty: true } as any : s))}
                      placeholder="Descrição opcional"
                      className="rounded-lg text-sm"
                      data-testid={`input-sponsor-desc-${sponsor.id}`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch(`/api/sponsors/${sponsor.id}`, { method: "DELETE", credentials: "include" });
                      setSponsors(prev => prev.filter(s => s.id !== sponsor.id));
                    }}
                    className="text-red-500 hover:text-red-700 p-1 transition-colors"
                    data-testid={`button-remove-sponsor-${sponsor.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {newSponsors.map((ns, idx) => (
              <div key={`new-${idx}`} className="border rounded-lg p-3 space-y-3 bg-blue-50/50 ring-1 ring-blue-200" data-testid={`card-new-sponsor-${idx}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <img src={ns.preview} alt="Novo patrocinador" className="w-16 h-16 rounded-lg object-contain border p-1 bg-white" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={ns.name}
                        onChange={e => setNewSponsors(prev => prev.map((s, i) => i === idx ? { ...s, name: e.target.value } : s))}
                        placeholder="Nome do patrocinador"
                        className="rounded-lg text-sm"
                        data-testid={`input-new-sponsor-name-${idx}`}
                      />
                      <Input
                        type="number"
                        value={ns.displayOrder}
                        onChange={e => setNewSponsors(prev => prev.map((s, i) => i === idx ? { ...s, displayOrder: parseInt(e.target.value) || 0 } : s))}
                        className="rounded-lg text-sm w-20"
                        title="Ordem de exibição"
                        data-testid={`input-new-sponsor-order-${idx}`}
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <Input
                        value={ns.linkUrl}
                        onChange={e => setNewSponsors(prev => prev.map((s, i) => i === idx ? { ...s, linkUrl: e.target.value } : s))}
                        placeholder="https://link-do-patrocinador.com"
                        className="rounded-lg text-sm"
                        data-testid={`input-new-sponsor-link-${idx}`}
                      />
                    </div>
                    <Input
                      value={ns.description}
                      onChange={e => setNewSponsors(prev => prev.map((s, i) => i === idx ? { ...s, description: e.target.value } : s))}
                      placeholder="Descrição opcional"
                      className="rounded-lg text-sm"
                      data-testid={`input-new-sponsor-desc-${idx}`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(ns.preview);
                      setNewSponsors(prev => prev.filter((_, i) => i !== idx));
                    }}
                    className="text-red-500 hover:text-red-700 p-1 transition-colors"
                    data-testid={`button-remove-new-sponsor-${idx}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {sponsors.length === 0 && newSponsors.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum patrocinador adicionado. Clique em "Adicionar Patrocinador" para começar.
              </p>
            )}

            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                <Label>Ativar carrossel do patrocínio</Label>
                <p className="text-xs text-muted-foreground">Exibir logos em carrossel animado em vez de grade estática.</p>
              </div>
              <Switch
                checked={sponsorCarouselEnabled}
                onCheckedChange={setSponsorCarouselEnabled}
                data-testid="switch-sponsor-carousel"
              />
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label>Descrição Geral dos Patrocinadores</Label>
              <Textarea
                value={sponsorDescription}
                onChange={e => setSponsorDescription(e.target.value)}
                placeholder="Texto sobre os patrocinadores. Use **negrito**, [links](url) e parágrafos."
                className="rounded-lg min-h-[80px]"
                data-testid="input-sponsor-description"
              />
              <p className="text-xs text-muted-foreground">
                Suporta formatação: **negrito**, [texto do link](url) e parágrafos separados por linha em branco.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-md">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-lg">Camisetas</CardTitle>
            <Button variant="secondary" size="sm" onClick={addJersey} className="rounded-lg" data-testid="button-add-jersey">
              <Plus className="w-4 h-4 mr-1.5" />
              Adicionar Camiseta
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {jerseyForms.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <Shirt className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <p className="font-medium mb-1">Nenhuma camiseta adicionada</p>
                <p className="text-sm">Adicione pelo menos uma camiseta ao formulário.</p>
              </div>
            ) : (
              jerseyForms.map((jersey, index) => (
                <div
                  key={index}
                  className="border rounded-xl p-5 space-y-4 bg-muted/20"
                  data-testid={`jersey-form-${index}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-medium">Camiseta #{index + 1}</h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-lg text-muted-foreground hover:text-destructive"
                      onClick={() => removeJersey(index)}
                      data-testid={`button-remove-jersey-${index}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label>Nome *</Label>
                      <Input
                        value={jersey.name}
                        onChange={e => updateJersey(index, "name", e.target.value)}
                        placeholder="Ex: Camisa Principal"
                        className="rounded-lg"
                        data-testid={`input-jersey-name-${index}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Preço</Label>
                      <Input
                        value={decimalToBRL(jersey.price)}
                        onChange={e => updateJersey(index, "price", brlToDecimal(e.target.value))}
                        placeholder="R$ 0,00"
                        className="rounded-lg"
                        data-testid={`input-jersey-price-${index}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Modelo *</Label>
                      <Input
                        value={jersey.modelType}
                        onChange={e => updateJersey(index, "modelType", e.target.value)}
                        placeholder="Ex: Gola V, Gola Redonda"
                        className="rounded-lg"
                        data-testid={`input-jersey-model-${index}`}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Gênero</Label>
                      <Select
                        value={jersey.genderType}
                        onValueChange={v => updateJersey(index, "genderType", v)}
                      >
                        <SelectTrigger className="rounded-lg" data-testid={`select-jersey-gender-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Masculino</SelectItem>
                          <SelectItem value="female">Feminino</SelectItem>
                          <SelectItem value="unisex">Unissex</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo de Público</Label>
                      <Select
                        value={jersey.audienceType}
                        onValueChange={v => updateJersey(index, "audienceType", v)}
                      >
                        <SelectTrigger className="rounded-lg" data-testid={`select-jersey-audience-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AUDIENCE_TYPES.map(t => (
                            <SelectItem key={t} value={t}>
                              {AUDIENCE_LABELS[t]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Define os tamanhos disponíveis: adulto, infantil ou ambos.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Números Permitidos</Label>
                      <Input
                        value={jersey.allowedNumbers}
                        onChange={e => updateJersey(index, "allowedNumbers", e.target.value)}
                        placeholder="Ex: 1,2,3,10-25"
                        className="rounded-lg"
                        data-testid={`input-jersey-allowed-numbers-${index}`}
                      />
                      <p className="text-xs text-muted-foreground">
                        Deixe vazio para permitir todos. Use vírgulas e intervalos (ex: 1,2,5-10,15).
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição da Camiseta</Label>
                    <textarea
                      value={jersey.description || ""}
                      onChange={e => updateJersey(index, "description", e.target.value)}
                      placeholder="Descrição detalhada da camiseta (material, tecnologia, etc.)"
                      className="w-full rounded-lg border px-3 py-2 text-sm min-h-[60px] resize-y"
                      data-testid={`input-jersey-description-${index}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Imagem Principal</Label>
                    <div className="flex items-center gap-4">
                      {jersey.imageUrl && (
                        <img src={jersey.imageUrl} alt={jersey.name} className="w-16 h-16 rounded-xl object-cover shadow-sm" />
                      )}
                      <label className="cursor-pointer">
                        <div className="flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm text-muted-foreground hover:bg-muted/50 transition-colors">
                          <Upload className="w-4 h-4" />
                          {jersey.imageUrl ? "Alterar" : "Enviar Imagem"}
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => handleJerseyImage(index, e)}
                          data-testid={`input-jersey-image-${index}`}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Galeria de Imagens</Label>
                    <div className="flex flex-wrap gap-2">
                      {(jersey.existingGalleryImages || []).map((img: string, gIdx: number) => (
                        <div key={`existing-${gIdx}`} className="relative group">
                          <img src={img} alt={`Galeria ${gIdx + 1}`} className="w-14 h-14 rounded-lg object-cover shadow-sm" />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...(jersey.existingGalleryImages || [])];
                              updated.splice(gIdx, 1);
                              updateJersey(index, "existingGalleryImages", updated);
                            }}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            data-testid={`button-remove-gallery-${index}-${gIdx}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {(jersey.galleryPreviews || []).map((img: string, gIdx: number) => (
                        <div key={`new-${gIdx}`} className="relative group">
                          <img src={img} alt={`Nova ${gIdx + 1}`} className="w-14 h-14 rounded-lg object-cover shadow-sm ring-2 ring-blue-300" />
                          <button
                            type="button"
                            onClick={() => {
                              URL.revokeObjectURL(img);
                              const updatedPreviews = [...(jersey.galleryPreviews || [])];
                              const updatedFiles = [...(jersey.galleryFiles || [])];
                              updatedPreviews.splice(gIdx, 1);
                              updatedFiles.splice(gIdx, 1);
                              updateJersey(index, "galleryPreviews", updatedPreviews);
                              updateJersey(index, "galleryFiles", updatedFiles);
                            }}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            data-testid={`button-remove-new-gallery-${index}-${gIdx}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <label className="cursor-pointer">
                        <div className="w-14 h-14 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors">
                          <Plus className="w-5 h-5" />
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={e => {
                            const files = Array.from(e.target.files || []);
                            if (files.length > 0) {
                              const previews = files.map(f => URL.createObjectURL(f));
                              updateJersey(index, "galleryFiles", [...(jersey.galleryFiles || []), ...files]);
                              updateJersey(index, "galleryPreviews", [...(jersey.galleryPreviews || []), ...previews]);
                            }
                          }}
                          data-testid={`input-jersey-gallery-${index}`}
                        />
                      </label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Adicione imagens extras (costas, detalhes). Até 10 imagens por camiseta.
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
