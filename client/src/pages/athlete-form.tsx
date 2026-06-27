import { useState, useEffect, useCallback, useMemo, useRef, type CSSProperties } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Form, Jersey, JerseyOrder, NumberReservation, FormSponsor } from "@shared/schema";
import { THEMES, MALE_SIZES, MALE_ADULT_SIZES, MALE_CHILD_SIZES, FEMALE_SIZES, AVAILABLE_NUMBERS } from "@shared/schema";
import {
  Shirt, Check, AlertCircle, CheckCircle2, User, Phone, CreditCard,
  Plus, ShoppingCart, ChevronUp, ChevronDown, X, MessageCircle,
  Eye, ArrowLeft, ArrowRight, Clock, ExternalLink, Minus, ZoomIn
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import JerseyPreview from "@/components/jersey-preview";
import JerseyImageModal from "@/components/jersey-image-modal";
import TryOnModal from "@/components/tryon-modal";
import SponsorCarousel from "@/components/sponsor-carousel";

interface JerseyItem {
  size: string;
  number: string;
  customNumber: string;
  nickname: string;
}

interface OrderFormData {
  jerseyId: number;
  quantity: number;
  items: JerseyItem[];
}

type FormStep = "cpf" | "info" | "jerseys" | "summary";

export default function AthleteForm() {
  const params = useParams<{ shareId: string }>();
  const { toast } = useToast();

  const [step, setStep] = useState<FormStep>("cpf");
  const [athleteName, setAthleteName] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [orders, setOrders] = useState<OrderFormData[]>([]);
  const [existingResponseId, setExistingResponseId] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [orderResult, setOrderResult] = useState<{ id: number; totalAmount: string; paymentStatus: string; asaasPaymentUrl: string | null } | null>(null);
  const [numberStatuses, setNumberStatuses] = useState<Record<string, { available: boolean; takenBy?: string }>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [cpfDashboardOrders, setCpfDashboardOrders] = useState<any[] | null>(null);
  const [customerData, setCustomerData] = useState<{ name: string; phone: string } | null>(null);
  const [customerLookedUp, setCustomerLookedUp] = useState(false);
  const [editingExisting, setEditingExisting] = useState(false);
  const [configJersey, setConfigJersey] = useState<number | null>(null);
  const [imageModalJersey, setImageModalJersey] = useState<Jersey | null>(null);
  const [imageModalPreview, setImageModalPreview] = useState<{ number: string; nickname: string } | null>(null);
  const [cacheRestored, setCacheRestored] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reservations, setReservations] = useState<NumberReservation[]>([]);
  const [myReservations, setMyReservations] = useState<Map<string, Date>>(new Map());
  const [reservationTimers, setReservationTimers] = useState<Map<string, number>>(new Map());
  const [showTimerDialog, setShowTimerDialog] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const timerIntervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const { data: form, isLoading: formLoading } = useQuery<Form>({
    queryKey: [`/api/forms/share/${params.shareId}`],
  });

  const { data: jerseyList } = useQuery<Jersey[]>({
    queryKey: [`/api/forms/${form?.id}/jerseys`],
    enabled: !!form,
  });

  const { data: takenNumbers } = useQuery<Array<{ number: string; athleteName: string; responseId: number; jerseyId: number; gender: string }>>({
    queryKey: [`/api/forms/${form?.id}/numbers`],
    enabled: !!form,
  });

  const { data: reservationsData } = useQuery<NumberReservation[]>({
    queryKey: [`/api/forms/${form?.id}/reservations`],
    enabled: !!form,
    refetchInterval: 30000,
  });

  const { data: sponsorsData } = useQuery<FormSponsor[]>({
    queryKey: [`/api/forms/${form?.id}/sponsors`],
    enabled: !!form,
  });

  const { data: privacyPolicyData } = useQuery<{ content: string }>({
    queryKey: ["/api/privacy-policy"],
  });

  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showTryOn, setShowTryOn] = useState(false);

  useEffect(() => {
    if (reservationsData) setReservations(reservationsData);
  }, [reservationsData]);

  useEffect(() => {
    if (!form?.id) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws?formId=${form.id}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "number_reserved") {
          setReservations(prev => {
            const filtered = prev.filter(r => !(r.jerseyId === data.jerseyId && r.number === data.number && r.gender === (data.gender || "male")));
            return [...filtered, { id: 0, jerseyId: data.jerseyId, number: data.number, gender: data.gender || "male", reservedBy: "", reservedByName: data.reservedByName, expiresAt: new Date(data.expiresAt), createdAt: new Date() }];
          });
        } else if (data.type === "number_released_by_user" || data.type === "number_released_by_admin" || data.type === "number_released") {
          setReservations(prev => prev.filter(r => !(r.jerseyId === data.jerseyId && r.number === data.number && (!data.gender || r.gender === data.gender))));
          queryClient.invalidateQueries({ queryKey: [`/api/forms/${form.id}/numbers`] });
        } else if (data.type === "number_confirmed") {
          setReservations(prev => prev.filter(r => !(r.jerseyId === data.jerseyId && r.number === data.number && (!data.gender || r.gender === data.gender))));
          queryClient.invalidateQueries({ queryKey: [`/api/forms/${form.id}/numbers`] });
        } else if (data.type === "number_removed_from_gender" || data.type === "number_added_to_gender") {
          queryClient.invalidateQueries({ queryKey: [`/api/forms/${form.id}/numbers`] });
          queryClient.invalidateQueries({ queryKey: [`/api/forms/${form.id}/reservations`] });
        }
      } catch {}
    };

    ws.onerror = () => {};
    ws.onclose = () => {};

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [form?.id]);

  const reserveNumber = useCallback(async (jerseyId: number, number: string) => {
    if (!cpf || cpf.replace(/\D/g, "").length !== 11) return;
    const cpfDigits = cpf.replace(/\D/g, "");
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jerseyId, number, gender, reservedBy: cpfDigits, reservedByName: athleteName || "Atleta" }),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: err.message || "Erro ao reservar número.", variant: "destructive" });
        return;
      }
      const reservation = await res.json();
      const key = `${jerseyId}-${number}`;
      const expiresAt = new Date(reservation.expiresAt);
      setMyReservations(prev => new Map(prev).set(key, expiresAt));

      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
        setReservationTimers(prev => new Map(prev).set(key, remaining));
        if (remaining <= 0) {
          clearInterval(interval);
          timerIntervalsRef.current.delete(key);
          setShowTimerDialog(key);
        }
      }, 1000);

      if (timerIntervalsRef.current.has(key)) {
        clearInterval(timerIntervalsRef.current.get(key));
      }
      timerIntervalsRef.current.set(key, interval);
    } catch {
      toast({ title: "Erro ao reservar número. Tente novamente.", variant: "destructive" });
    }
  }, [cpf, athleteName, toast]);

  const releaseReservation = useCallback(async (jerseyId: number, number: string) => {
    const key = `${jerseyId}-${number}`;
    try {
      await fetch(`/api/reservations/${jerseyId}/${encodeURIComponent(number)}`, { method: "DELETE" });
    } catch {}
    setMyReservations(prev => { const m = new Map(prev); m.delete(key); return m; });
    setReservationTimers(prev => { const m = new Map(prev); m.delete(key); return m; });
    if (timerIntervalsRef.current.has(key)) {
      clearInterval(timerIntervalsRef.current.get(key));
      timerIntervalsRef.current.delete(key);
    }
    setShowTimerDialog(null);
  }, []);

  const renewReservation = useCallback(async (jerseyId: number, number: string) => {
    setShowTimerDialog(null);
    await reserveNumber(jerseyId, number);
  }, [reserveNumber]);

  useEffect(() => {
    return () => {
      timerIntervalsRef.current.forEach(interval => clearInterval(interval));
    };
  }, []);

  useEffect(() => {
    if (jerseyList && jerseyList.length > 0 && orders.length === 0 && !existingResponseId) {
      setOrders(jerseyList.map(j => ({
        jerseyId: j.id,
        quantity: 0,
        items: [],
      })));
    }
  }, [jerseyList, step]);

  const { data: polledOrder } = useQuery<any>({
    queryKey: [`/api/orders/${orderResult?.id}`],
    enabled: !!orderResult && orderResult.paymentStatus !== "PAID" && orderResult.paymentStatus !== "CANCELLED",
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (polledOrder && orderResult && polledOrder.paymentStatus !== orderResult.paymentStatus) {
      setOrderResult(prev => prev ? { ...prev, paymentStatus: polledOrder.paymentStatus } : prev);
    }
  }, [polledOrder]);

  const getSizes = useCallback((jerseyGender: string, jerseyAudienceType?: string) => {
    if (gender === "female" || jerseyGender === "female") return FEMALE_SIZES;
    if (jerseyAudienceType === "child") return MALE_CHILD_SIZES;
    if (jerseyAudienceType === "adult") return MALE_ADULT_SIZES;
    return MALE_SIZES;
  }, [gender]);

  const checkNumber = useCallback(async (number: string, key: string, jerseyId?: number) => {
    if (!form || !number) return;
    try {
      const endpoint = jerseyId
        ? `/api/forms/${form.id}/check-number-jersey`
        : `/api/forms/${form.id}/check-number`;
      const body: any = { number, excludeResponseId: existingResponseId, gender };
      if (jerseyId) body.jerseyId = jerseyId;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      setNumberStatuses(prev => ({ ...prev, [key]: result }));
    } catch {
    }
  }, [form, existingResponseId, gender]);

  const updateOrderQuantity = (jerseyIndex: number, qty: number) => {
    setOrders(prev => {
      const updated = [...prev];
      const order = { ...updated[jerseyIndex] };
      const existingItems = order.items || [];
      const newItems: JerseyItem[] = [];
      for (let i = 0; i < qty; i++) {
        newItems.push(existingItems[i] || { size: "", number: "", customNumber: "", nickname: "" });
      }
      order.quantity = qty;
      order.items = newItems;
      updated[jerseyIndex] = order;
      return updated;
    });
  };

  const updateItem = (jerseyIndex: number, itemIndex: number, field: string, value: string) => {
    setOrders(prev => {
      const updated = [...prev];
      const order = { ...updated[jerseyIndex] };
      const items = [...order.items];
      items[itemIndex] = { ...items[itemIndex], [field]: value };
      order.items = items;
      updated[jerseyIndex] = order;
      return updated;
    });
    if (field === "number" && value && value !== "other") {
      const jerseyId = orders[jerseyIndex]?.jerseyId;
      checkNumber(value, `${jerseyIndex}-${itemIndex}`, jerseyId);
    }
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const activeOrders = orders
        .filter(o => o.quantity > 0 && o.items.length > 0)
        .map(o => {
          const first = o.items[0];
          const extras = o.items.slice(1);
          return {
            jerseyId: o.jerseyId,
            quantity: o.quantity,
            size: first.size,
            number: first.number === "other" ? first.customNumber : first.number,
            nickname: first.nickname,
            extraNumbers: extras.length > 0 ? extras.map(e => ({
              number: e.number === "other" ? e.customNumber : e.number,
              nickname: e.nickname,
              size: e.size,
            })) : null,
          };
        });

      const payload = { athleteName, cpf, phone, gender, orders: activeOrders };

      if (existingResponseId) {
        const res = await apiRequest("PUT", `/api/responses/${existingResponseId}`, payload);
        return await res.json();
      }

      const postRes = await fetch(`/api/forms/${form!.id}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (postRes.status === 409) {
        const errorData = await postRes.json();
        if (errorData.existingId) {
          setExistingResponseId(errorData.existingId);
          const putRes = await apiRequest("PUT", `/api/responses/${errorData.existingId}`, payload);
          return await putRes.json();
        }
      }

      if (!postRes.ok) {
        const errorData = await postRes.json().catch(() => ({}));
        throw new Error(JSON.stringify(errorData));
      }

      return await postRes.json();
    },
    onSuccess: (data: any) => {
      setSubmitted(true);
      if (data?.order) {
        setOrderResult(data.order);
      }
      queryClient.invalidateQueries({ queryKey: [`/api/forms/${form?.id}/numbers`] });
      clearFormCache();
      toast({ title: existingResponseId ? "Resposta atualizada!" : "Resposta enviada!" });
    },
    onError: (err: any) => {
      let msg = "Erro ao enviar resposta";
      try {
        const errText = err.message || "";
        const jsonMatch = errText.match(/\{.*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.message) msg = parsed.message;
        }
      } catch {}
      toast({ title: msg, variant: "destructive" });
    },
  });

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

  const cartSummary = useMemo(() => {
    if (!jerseyList) return { items: [], totalJerseys: 0, totalPrice: 0 };
    const items: Array<{ name: string; qty: number; price: number; unitPrice: number }> = [];
    let totalJerseys = 0;
    let totalPrice = 0;
    orders.forEach((o, i) => {
      if (o.quantity > 0) {
        const jersey = jerseyList[i];
        if (jersey) {
          const unitPrice = parseFloat(jersey.price) || 0;
          const price = unitPrice * o.quantity;
          items.push({ name: jersey.name, qty: o.quantity, price, unitPrice });
          totalJerseys += o.quantity;
          totalPrice += price;
        }
      }
    });
    return { items, totalJerseys, totalPrice };
  }, [orders, jerseyList]);

  const allItemsComplete = useMemo(() => {
    return orders.every((o, jerseyIndex) => {
      if (o.quantity === 0) return true;
      return o.items.every((item, itemIndex) => {
        const num = item.number === "other" ? item.customNumber : item.number;
        if (!item.size || !num || !item.nickname) return false;
        if (item.number === "other" && item.customNumber && form?.numberRuleUnique) {
          const gridKey = `${jerseyIndex}-${itemIndex}`;
          const status = numberStatuses[gridKey];
          if (!status || !status.available) return false;
        }
        return true;
      });
    });
  }, [orders, numberStatuses, form?.numberRuleUnique]);

  const orderSummaryItems = useMemo(() => {
    if (!jerseyList) return [];
    const items: Array<{ jerseyName: string; size: string; number: string; nickname: string; unitPrice: number }> = [];
    orders.forEach((o, i) => {
      if (o.quantity > 0) {
        const jersey = jerseyList[i];
        if (!jersey) return;
        const unitPrice = parseFloat(jersey.price) || 0;
        o.items.forEach(item => {
          items.push({
            jerseyName: jersey.name,
            size: item.size,
            number: item.number === "other" ? item.customNumber : item.number,
            nickname: item.nickname,
            unitPrice,
          });
        });
      }
    });
    return items;
  }, [orders, jerseyList]);

  const getFilteredNumbers = useCallback((jersey: Jersey) => {
    if (jersey.allowedNumbers) {
      const parts = jersey.allowedNumbers.split(",").map(p => p.trim()).filter(Boolean);
      const allowed: string[] = [];
      const seen = new Set<string>();
      for (const part of parts) {
        const rangeMatch = part.match(/^(\d+)\s*[-–]\s*(\d+)$/);
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1]);
          const end = parseInt(rangeMatch[2]);
          for (let i = start; i <= end; i++) {
            const num = String(i).padStart(2, "0");
            if (!seen.has(num)) { seen.add(num); allowed.push(num); }
          }
        } else {
          const num = part.padStart(2, "0");
          if (!seen.has(num)) { seen.add(num); allowed.push(num); }
        }
      }
      if (allowed.length > 0) {
        return allowed;
      }
    }
    return AVAILABLE_NUMBERS;
  }, []);

  const cacheKey = form ? `nteamkit-form-${form.id}` : null;

  const saveFormCache = useCallback(() => {
    if (!cacheKey || !cpf) return;
    const cpfDigits = cpf.replace(/\D/g, "");
    if (cpfDigits.length !== 11) return;
    const key = `${cacheKey}-${cpfDigits}`;
    const data = { athleteName, cpf, phone, gender, orders, step, timestamp: Date.now() };
    try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
  }, [cacheKey, athleteName, cpf, phone, gender, orders, step]);

  const clearFormCache = useCallback(() => {
    if (!cacheKey || !cpf) return;
    const cpfDigits = cpf.replace(/\D/g, "");
    try { localStorage.removeItem(`${cacheKey}-${cpfDigits}`); } catch {}
  }, [cacheKey, cpf]);

  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (step !== "cpf" && !submitted) {
      saveTimerRef.current = setTimeout(saveFormCache, 1000);
    }
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [athleteName, cpf, phone, gender, orders, step, submitted, saveFormCache]);

  const restoreFormCache = useCallback((cpfDigits: string) => {
    if (!cacheKey) return false;
    const key = `${cacheKey}-${cpfDigits}`;
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return false;
      const data = JSON.parse(cached);
      const age = Date.now() - (data.timestamp || 0);
      if (age > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(key);
        return false;
      }
      if (data.athleteName) setAthleteName(data.athleteName);
      if (data.cpf) setCpf(data.cpf);
      if (data.phone) setPhone(data.phone);
      if (data.gender) setGender(data.gender);
      if (data.orders && data.orders.length > 0) {
        const hasItems = data.orders.some((o: any) => o.quantity > 0);
        const allComplete = data.orders.every((o: any) => {
          if (o.quantity === 0) return true;
          return o.items?.every((item: any) => {
            const num = item.number === "other" ? item.customNumber : item.number;
            return item.size && num && item.nickname;
          });
        });
        if (hasItems) setOrders(data.orders);
        if (data.step && data.step !== "cpf" && allComplete) {
          setStep(data.step);
        }
      }
      setCacheRestored(true);
      return true;
    } catch { return false; }
  }, [cacheKey]);

  const cpfDigits = cpf.replace(/\D/g, "");

  const lookupCpf = useCallback(async (digits: string) => {
    if (!form || digits.length !== 11) return;

    try {
      const res = await fetch(`/api/customers/lookup-cpf?cpf=${digits}`);
      if (res.ok) {
        const customer = await res.json();
        setCustomerData({ name: customer.name, phone: customer.phone });
        if (!athleteName) setAthleteName(customer.name);
        if (!phone) setPhone(formatPhone(customer.phone));
      } else {
        setCustomerData(null);
      }
    } catch {
      setCustomerData(null);
    }

    try {
      const ordersRes = await fetch(`/api/forms/${form.id}/orders/lookup-cpf?cpf=${digits}`);
      const ordersData = await ordersRes.json();
      if (ordersData && ordersData.length > 0) {
        setCpfDashboardOrders(ordersData);
      } else {
        setCpfDashboardOrders(null);
      }
    } catch {
      setCpfDashboardOrders(null);
    }

    setCustomerLookedUp(true);
  }, [form, athleteName, phone]);

  const loadExistingOrder = useCallback(async () => {
    if (!form || !cpfDashboardOrders || cpfDashboardOrders.length === 0) return;
    const latestOrder = cpfDashboardOrders[0];
    try {
      const phoneDigits = phone.replace(/\D/g, "");
      let loaded = false;

      if (phoneDigits.length >= 10) {
        const res = await fetch(`/api/forms/${form.id}/responses/lookup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cpf: cpfDigits, phone: phoneDigits }),
        });
        if (res.ok) {
          const data = await res.json();
          setExistingResponseId(data.response.id);
          setAthleteName(data.response.athleteName);
          setCpf(formatCpf(data.response.cpf));
          setPhone(formatPhone(data.response.phone));
          setGender(data.response.gender);
          if (jerseyList && data.orders) {
            loadJerseyOrders(data.orders);
          }
          loaded = true;
        }
      }

      if (!loaded) {
        const resByCpf = await fetch(`/api/orders/${latestOrder.id}/detail`);
        if (resByCpf.ok) {
          const detail = await resByCpf.json();
          if (detail.response) {
            setExistingResponseId(detail.response.id);
            setAthleteName(detail.response.athleteName);
            setCpf(formatCpf(detail.response.cpf));
            setPhone(formatPhone(detail.response.phone));
            setGender(detail.response.gender);
            if (jerseyList && detail.jerseyOrders) {
              loadJerseyOrders(detail.jerseyOrders);
            }
            loaded = true;
          }
        }
      }

      if (loaded) {
        setCacheRestored(false);
        setEditingExisting(true);
        setStep("jerseys");
        toast({ title: "Pedido carregado para edição." });
      } else {
        toast({ title: "Não foi possível carregar o pedido para edição.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Erro ao carregar pedido.", variant: "destructive" });
    }
  }, [form, cpfDashboardOrders, cpfDigits, phone, jerseyList]);

  const loadJerseyOrders = (jerseyOrders: JerseyOrder[]) => {
    if (!jerseyList) return;
    const orderMap = new Map<number, JerseyOrder>();
    jerseyOrders.forEach(o => orderMap.set(o.jerseyId, o));
    setOrders(jerseyList.map(j => {
      const existing = orderMap.get(j.id);
      if (existing) {
        const items: JerseyItem[] = [{
          size: existing.size,
          number: AVAILABLE_NUMBERS.includes(existing.number) ? existing.number : "other",
          customNumber: AVAILABLE_NUMBERS.includes(existing.number) ? "" : existing.number,
          nickname: existing.nickname,
        }];
        if (existing.extraNumbers) {
          for (const e of existing.extraNumbers) {
            items.push({
              size: (e as any).size || existing.size,
              number: AVAILABLE_NUMBERS.includes(e.number) ? e.number : "other",
              customNumber: AVAILABLE_NUMBERS.includes(e.number) ? "" : e.number,
              nickname: e.nickname,
            });
          }
        }
        return { jerseyId: j.id, quantity: existing.quantity, items };
      }
      return { jerseyId: j.id, quantity: 0, items: [] };
    }));
  };

  if (formLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-xl shadow-lg">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Formulário Não Encontrado</h2>
            <p className="text-muted-foreground">Este formulário não existe ou o link é inválido.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const themeColor = THEMES.find(t => t.value === form.theme)?.primary || "#2563eb";
  const isExpired = form.deadline && new Date(form.deadline) < new Date();

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "PAID": case "RECEIVED": case "CONFIRMED": return "Pago";
      case "PAGAMENTO_PARCIAL": return "Pagamento Parcial";
      case "OVERDUE": return "Vencido";
      case "CANCELLED": return "Cancelado";
      case "CANCELLED_BY_ADMIN": return "Cancelado pelo Admin";
      default: return "Aguardando pagamento";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PAID": case "RECEIVED": case "CONFIRMED": return "bg-emerald-100 text-emerald-800";
      case "PAGAMENTO_PARCIAL": return "bg-orange-100 text-orange-800";
      case "OVERDUE": return "bg-red-100 text-red-800";
      case "CANCELLED": case "CANCELLED_BY_ADMIN": return "bg-red-100 text-red-800";
      default: return "bg-amber-100 text-amber-800";
    }
  };

  if (submitted) {
    const hasPayment = orderResult && orderResult.totalAmount && parseFloat(orderResult.totalAmount) > 0;
    const isPaid = ["PAID", "RECEIVED", "CONFIRMED"].includes(orderResult?.paymentStatus || "");
    const isCancelled = orderResult?.paymentStatus === "CANCELLED";
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-xl shadow-lg">
          <CardContent className="pt-10 pb-10 text-center">
            <div
              className="w-20 h-20 rounded-2xl mx-auto mb-5 flex items-center justify-center"
              style={{ backgroundColor: isPaid ? "#10b98115" : themeColor + "15" }}
            >
              {isPaid ? (
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              ) : (
                <Clock className="w-10 h-10" style={{ color: themeColor }} />
              )}
            </div>
            <h2 className="text-2xl font-semibold mb-2" data-testid="text-success">
              {isPaid ? "Pagamento Confirmado!" : "Pedido Registrado!"}
            </h2>
            <p className="text-muted-foreground mb-4">
              {isPaid
                ? `Seu pagamento para ${form.teamName} foi confirmado.`
                : `Suas escolhas de uniforme para ${form.teamName} foram registradas.`
              }
            </p>

            {hasPayment && (
              <div className={`${isPaid ? "bg-emerald-50" : "bg-muted/50"} rounded-xl p-5 mb-6 text-left`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground">Pedido #{orderResult.id}</span>
                  <Badge className={`rounded-full text-xs ${getStatusColor(orderResult.paymentStatus)}`} data-testid="badge-payment-status">
                    {getStatusLabel(orderResult.paymentStatus)}
                  </Badge>
                </div>
                <div className="text-2xl font-bold mb-4" data-testid="text-order-total">
                  R$ {parseFloat(orderResult.totalAmount).toFixed(2).replace(".", ",")}
                </div>
                {!isPaid && !isCancelled && (
                  <>
                    <p className="text-xs text-muted-foreground mb-3">
                      O status do pagamento atualiza automaticamente.
                    </p>
                    <div className="flex flex-col gap-2">
                      {orderResult.asaasPaymentUrl && (
                        <Button
                          className="rounded-lg w-full"
                          style={{ backgroundColor: themeColor }}
                          onClick={() => window.open(orderResult.asaasPaymentUrl!, "_blank")}
                          data-testid="button-pay-now"
                        >
                          <CreditCard className="w-4 h-4 mr-2" />
                          Pagar Agora
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        className="rounded-lg w-full"
                        onClick={() => { setSubmitted(false); setExistingResponseId(null); setOrderResult(null); setStep("cpf"); }}
                        data-testid="button-pay-later"
                      >
                        Pagar Depois
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}

            {!hasPayment && (
              <Button
                onClick={() => { setSubmitted(false); setExistingResponseId(null); setOrderResult(null); setStep("cpf"); }}
                variant="secondary"
                className="rounded-lg"
              >
                Enviar Outra Resposta
              </Button>
            )}

            {cpf && (
              <Link href={`/meus-pedidos/${cpf.replace(/\D/g, "")}`}>
                <Button variant="outline" className="rounded-lg w-full mt-3" data-testid="button-my-orders">
                  <Eye className="w-4 h-4 mr-2" />
                  Ver Meus Pedidos
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasActiveOrders = orders.some(o => o.quantity > 0);

  const renderNumberGrid = (
    gridKey: string,
    selectedNumber: string,
    onSelect: (num: string) => void,
    jerseyId: number,
    jersey: Jersey
  ) => {
    const filteredNumbers = getFilteredNumbers(jersey);
    const cpfDigits = cpf.replace(/\D/g, "");

    const activeTimerKeys = Array.from(myReservations.keys()).filter(k => k.startsWith(`${jerseyId}-`));
    const activeTimerEntry = activeTimerKeys.length > 0 ? activeTimerKeys[0] : null;
    const timerSeconds = activeTimerEntry ? reservationTimers.get(activeTimerEntry) : undefined;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 mb-2">
          {jersey.imageUrl && (
            <button
              type="button"
              className="relative group rounded-lg overflow-hidden flex-shrink-0"
              onClick={() => {
                setImageModalPreview(null);
                setImageModalJersey(jersey);
              }}
              data-testid={`jersey-image-${gridKey}`}
            >
              <img src={jersey.imageUrl} alt={jersey.name} className="h-16 w-auto rounded-lg object-contain" loading="lazy" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <ZoomIn className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
              </div>
            </button>
          )}
          <div>
            <h4 className="font-semibold text-sm">{jersey.name}</h4>
            <p className="text-xs text-muted-foreground">Selecione um número</p>
          </div>
        </div>

        {timerSeconds !== undefined && timerSeconds > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm" data-testid={`timer-${gridKey}`}>
            <Clock className="w-4 h-4 text-amber-600" />
            <span className="text-amber-800 font-medium">
              Seu número está reservado por {String(Math.floor(timerSeconds / 60)).padStart(2, "0")}:{String(timerSeconds % 60).padStart(2, "0")}
            </span>
          </div>
        )}

        <div className="grid grid-cols-5 sm:grid-cols-7 lg:grid-cols-9 gap-2">
          {filteredNumbers.map(num => {
            const taken = takenNumbers?.find(
              t => t.number === num && t.jerseyId === jerseyId && t.gender === gender && t.responseId !== existingResponseId
            );
            const isTaken = !!taken && form.numberRuleUnique;
            const isSelected = selectedNumber === num;
            const reservation = reservations.find(r => r.jerseyId === jerseyId && r.number === num && r.gender === gender && r.reservedBy !== cpfDigits);
            const isReservedByOther = !!reservation && new Date(reservation.expiresAt) > new Date();
            const myRes = myReservations.has(`${jerseyId}-${num}`);

            return (
              <Tooltip key={num}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    disabled={isTaken || isReservedByOther}
                    onClick={() => {
                      onSelect(num);
                      if (!isTaken && !isReservedByOther && !myRes) {
                        reserveNumber(jerseyId, num);
                      }
                    }}
                    className={`aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-medium border-2 transition-all ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-md scale-105"
                        : isTaken
                          ? "bg-red-50 border-red-300 text-red-400 cursor-not-allowed opacity-70"
                          : isReservedByOther
                            ? "bg-amber-50 border-amber-300 text-amber-600 cursor-not-allowed opacity-80"
                            : "bg-emerald-50 border-emerald-300 text-emerald-700 hover:border-primary hover:bg-primary/5 cursor-pointer"
                    }`}
                    data-testid={`number-grid-${gridKey}-${num}`}
                  >
                    <span className="text-base font-bold leading-none">{num}</span>
                    {isTaken ? (
                      <span className="text-[8px] font-medium truncate max-w-full px-0.5 text-center leading-tight mt-0.5">
                        {taken.athleteName.split(" ")[0]}
                      </span>
                    ) : isReservedByOther ? (
                      <span className="text-[8px] font-medium truncate max-w-full px-0.5 text-center leading-tight mt-0.5">
                        Reservado
                      </span>
                    ) : isSelected ? (
                      <Check className="w-3 h-3 mt-0.5" />
                    ) : (
                      <span className="text-[8px] font-medium opacity-60 mt-0.5">Disponível</span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {isTaken
                    ? `Número já escolhido por ${taken.athleteName}`
                    : isReservedByOther
                      ? `Número pré-reservado por ${reservation.reservedByName}`
                      : `Número ${num} disponível`}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => onSelect("other")}
          className={`w-full rounded-xl border-2 border-dashed p-3 flex items-center justify-center gap-2 font-medium transition-all ${
            selectedNumber === "other"
              ? "bg-[#F97316] text-white border-[#F97316] shadow-md"
              : "border-[#F97316]/40 text-[#F97316] hover:bg-[#F97316]/5 hover:border-[#F97316]"
          }`}
          data-testid={`button-other-number-${gridKey}`}
        >
          <Plus className="w-4 h-4" />
          Escolher outro número
        </button>
      </div>
    );
  };

  const renderJerseyItemBlock = (
    jerseyIndex: number,
    itemIndex: number,
    item: JerseyItem,
    jersey: Jersey,
    sizes: string[]
  ) => {
    const gridKey = `${jerseyIndex}-${itemIndex}`;
    return (
      <div
        key={itemIndex}
        className="border-2 border-border/60 rounded-xl p-5 space-y-4 bg-card"
        data-testid={`jersey-block-${jerseyIndex}-${itemIndex}`}
      >
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: themeColor }}
          >
            {itemIndex + 1}
          </div>
          <h4 className="font-semibold text-sm">Camisa {itemIndex + 1}</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tamanho *</Label>
            <Select
              value={item.size}
              onValueChange={v => updateItem(jerseyIndex, itemIndex, "size", v)}
            >
              <SelectTrigger className="rounded-lg" data-testid={`select-size-${jerseyIndex}-${itemIndex}`}>
                <SelectValue placeholder="Selecione o tamanho" />
              </SelectTrigger>
              <SelectContent>
                {sizes.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Nome/Apelido na Camisa *</Label>
            <Input
              value={item.nickname}
              onChange={e => updateItem(jerseyIndex, itemIndex, "nickname", e.target.value.toUpperCase())}
              placeholder="Nome na camiseta"
              className="rounded-lg"
              data-testid={`input-nickname-${jerseyIndex}-${itemIndex}`}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Número *</Label>
          {renderNumberGrid(gridKey, item.number, (num) => updateItem(jerseyIndex, itemIndex, "number", num), jersey.id, jersey)}

          {item.number === "other" && (
            <div className="space-y-2 mt-3">
              <Label className="text-sm text-muted-foreground">Digite o número desejado</Label>
              <Input
                value={item.customNumber}
                onChange={e => {
                  updateItem(jerseyIndex, itemIndex, "customNumber", e.target.value);
                  if (e.target.value) {
                    checkNumber(e.target.value, gridKey, jersey.id);
                  }
                }}
                placeholder="Ex: 99"
                className="rounded-lg w-full sm:w-48"
                data-testid={`input-custom-number-${gridKey}`}
              />
              {numberStatuses[gridKey] && (
                <div className={`flex items-center gap-1.5 text-sm ${
                  numberStatuses[gridKey].available ? "text-emerald-600" : "text-destructive"
                }`}>
                  {numberStatuses[gridKey].available ? (
                    <><Check className="w-3.5 h-3.5" /> Número disponível</>
                  ) : (
                    <><AlertCircle className="w-3.5 h-3.5" /> Número já escolhido por {numberStatuses[gridKey].takenBy}</>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <JerseyPreview
          number={item.number === "other" ? item.customNumber : item.number}
          nickname={item.nickname}
          themeColor={themeColor}
        />
      </div>
    );
  };

  const renderHeader = () => (
    <div className="flex items-center gap-4">
      {form.logoUrl ? (
        <img src={form.logoUrl} alt={form.teamName} className="w-14 h-14 rounded-xl object-cover shadow-sm" />
      ) : (
        <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ backgroundColor: themeColor + "15" }}>
          <Shirt className="w-7 h-7" style={{ color: themeColor }} />
        </div>
      )}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="text-form-title">{form.teamName}</h1>
        <p className="text-muted-foreground text-sm">Formulário de Seleção de Uniformes</p>
        {form.deadline && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Prazo: {new Date(form.deadline).toLocaleDateString("pt-BR")}
          </p>
        )}
      </div>
    </div>
  );

  const renderWhatsApp = () => (
    (form as any).supportWhatsapp ? (
      <a
        href={`https://wa.me/${(form as any).supportWhatsapp}`}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 flex items-center gap-2 bg-[#25D366] hover:bg-[#20BD5A] text-white rounded-full px-4 py-3 shadow-lg transition-all hover:shadow-xl"
        data-testid="button-whatsapp-support"
      >
        <SiWhatsapp className="w-5 h-5" />
        <span className="text-sm font-medium hidden sm:inline">Precisa de ajuda?</span>
      </a>
    ) : null
  );

  const safeRichText = (text: string) => {
    const stripped = text.replace(/<[^>]*>/g, '');
    return stripped
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label: string, url: string) => {
        const safeUrl = url.startsWith('http://') || url.startsWith('https://') ? url : '#';
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="underline hover:opacity-80">${label.replace(/<[^>]*>/g, '')}</a>`;
      })
      .replace(/\n/g, '<br/>');
  };

  const handleSponsorClick = (sponsor: FormSponsor) => {
    if (sponsor.linkUrl) {
      fetch(`/api/sponsors/${sponsor.id}/click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ formId: form.id }),
      }).catch(() => {});
      window.open(sponsor.linkUrl, "_blank", "noopener,noreferrer");
    }
  };

  const renderSponsorLogo = (sponsor: FormSponsor, size: "sm" | "md" = "md") => {
    const sizeClass = size === "sm" ? "h-8 sm:h-10 max-w-[80px]" : "h-12 sm:h-16 max-w-[120px]";
    const wrapper = (
      <img
        src={sponsor.logoUrl}
        alt={sponsor.name || "Patrocinador"}
        title={sponsor.name || undefined}
        className={`${sizeClass} object-contain opacity-90 hover:opacity-100 transition-all duration-300 hover:scale-105`}
        data-testid={`img-sponsor-${sponsor.id}`}
      />
    );
    if (sponsor.linkUrl) {
      return (
        <button
          key={sponsor.id}
          type="button"
          onClick={() => handleSponsorClick(sponsor)}
          className="cursor-pointer"
          data-testid={`link-sponsor-${sponsor.id}`}
        >
          {wrapper}
        </button>
      );
    }
    return <div key={sponsor.id}>{wrapper}</div>;
  };

  const renderSponsorsTop = () => {
    if (!sponsorsData || sponsorsData.length === 0) return null;
    const useCarousel = form.sponsorCarouselEnabled;
    return (
      <div className="mt-6 space-y-3 animate-in fade-in duration-700" data-testid="section-sponsors">
        <h3 className="text-center text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Patrocinadores oficiais
        </h3>
        {useCarousel ? (
          <SponsorCarousel sponsors={sponsorsData} onSponsorClick={handleSponsorClick} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 items-center justify-items-center">
            {sponsorsData.map((sponsor) => renderSponsorLogo(sponsor))}
          </div>
        )}
        {form.sponsorDescription && (
          <div className="text-center text-xs text-muted-foreground px-4" data-testid="text-sponsor-description">
            {form.sponsorDescription.split(/\n\n+/).map((para, i) => (
              <p key={i} className="mb-1" dangerouslySetInnerHTML={{ __html: safeRichText(para) }} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderSponsorsSidebar = () => {
    if (!sponsorsData || sponsorsData.length === 0) return null;
    return (
      <div className="hidden lg:block fixed top-0 left-0 w-[200px] h-screen overflow-y-auto z-40" data-testid="sidebar-sponsors">
        <div className="p-4 pt-20 space-y-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">
            Patrocinadores
          </h4>
          <div className="flex flex-col items-center gap-3">
            {sponsorsData.map((sponsor) => (
              <div key={sponsor.id} className="animate-in fade-in slide-in-from-left duration-500" style={{ animationDelay: `${sponsor.displayOrder * 100}ms` } as CSSProperties}>
                {renderSponsorLogo(sponsor, "sm")}
                {sponsor.name && (
                  <p className="text-[10px] text-muted-foreground text-center mt-0.5 truncate max-w-[160px]">{sponsor.name}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderSponsorsMobileBar = () => {
    if (!sponsorsData || sponsorsData.length === 0) return null;
    return (
      <div className="lg:hidden sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b shadow-sm" data-testid="bar-sponsors-mobile">
        <div className="px-3 py-2">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider whitespace-nowrap flex-shrink-0 font-semibold">
              Patrocinadores
            </span>
            {sponsorsData.map((sponsor) => renderSponsorLogo(sponsor, "sm"))}
          </div>
        </div>
      </div>
    );
  };

  const renderSponsors = renderSponsorsTop;

  const renderPrivacyFooter = () => {
    if (!privacyPolicyData?.content) return null;
    return (
      <>
        <div className="text-center py-4 mt-6 border-t" data-testid="section-privacy-footer">
          <button
            type="button"
            onClick={() => setShowPrivacyPolicy(true)}
            className="text-xs text-muted-foreground hover:text-primary underline transition-colors"
            data-testid="button-privacy-policy"
          >
            Política de Privacidade
          </button>
        </div>
        <Dialog open={showPrivacyPolicy} onOpenChange={setShowPrivacyPolicy}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Política de Privacidade</DialogTitle>
            </DialogHeader>
            <div className="mt-4 text-sm" data-testid="content-privacy-policy">
              {privacyPolicyData.content.split(/\n\n+/).map((para, i) => (
                <p key={i} className="mb-3" dangerouslySetInnerHTML={{ __html: safeRichText(para) }} />
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  };

  if (isExpired) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-1.5 w-full" style={{ backgroundColor: themeColor }} />
        {renderSponsorsMobileBar()}
        <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
          {renderHeader()}
          {renderSponsorsTop()}
          <Card className="border-destructive/50 rounded-xl">
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">Este formulário expirou e não está mais aceitando respostas.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (step === "cpf") {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-1.5 w-full" style={{ backgroundColor: themeColor }} />
        {renderSponsorsMobileBar()}
        <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
          {renderHeader()}
          {renderSponsorsTop()}

          <Card className="rounded-xl shadow-md">
            <CardContent className="pt-8 pb-8 space-y-6">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center" style={{ backgroundColor: themeColor + "12" }}>
                  <User className="w-8 h-8" style={{ color: themeColor }} />
                </div>
                <h2 className="text-xl font-semibold">Digite seu CPF para começar</h2>
                <p className="text-muted-foreground text-sm">Usamos seu CPF para identificar você e seus pedidos</p>
              </div>

              <div className="space-y-3">
                <Input
                  value={cpf}
                  onChange={e => {
                    const newCpf = formatCpf(e.target.value);
                    setCpf(newCpf);
                    const digits = newCpf.replace(/\D/g, "");
                    if (digits.length < 11) {
                      setCustomerLookedUp(false);
                      setCustomerData(null);
                      setCpfDashboardOrders(null);
                    }
                  }}
                  placeholder="000.000.000-00"
                  className="rounded-lg text-center text-lg h-14"
                  data-testid="input-cpf"
                  autoFocus
                />

                {cpfDigits.length === 11 && !customerLookedUp && (
                  <Button
                    className="w-full rounded-lg h-12"
                    style={{ backgroundColor: themeColor }}
                    onClick={() => {
                      lookupCpf(cpfDigits);
                      const restored = restoreFormCache(cpfDigits);
                      if (restored) {
                        toast({ title: "Restauramos seu pedido em andamento." });
                      }
                    }}
                    data-testid="button-continue-cpf"
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    Continuar
                  </Button>
                )}

                {customerLookedUp && customerData && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span className="font-semibold text-emerald-800">Olá, {customerData.name}!</span>
                    </div>
                    <p className="text-sm text-emerald-700">Seus dados foram encontrados e preenchidos automaticamente.</p>
                  </div>
                )}

                {customerLookedUp && !customerData && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-sm text-blue-800">Não encontramos seu cadastro. Preencha seus dados na próxima etapa.</p>
                  </div>
                )}

                {customerLookedUp && cpfDashboardOrders && cpfDashboardOrders.length > 0 && (
                  <Card className="rounded-xl border-amber-200 bg-amber-50/50">
                    <CardContent className="pt-4 pb-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-amber-600" />
                        <span className="font-medium text-amber-800">Seus pedidos neste formulário</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm" data-testid="table-order-history">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="pb-2 pr-3 font-medium">Pedido</th>
                              <th className="pb-2 pr-3 font-medium">Status</th>
                              <th className="pb-2 pr-3 font-medium">Valor</th>
                              <th className="pb-2 font-medium">Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cpfDashboardOrders.map((order: any) => {
                              const isPaidStatus = ["PAID", "RECEIVED", "CONFIRMED"].includes(order.paymentStatus);
                              const isCancelledStatus = ["CANCELLED", "CANCELLED_BY_ADMIN"].includes(order.paymentStatus);
                              return (
                                <tr key={order.id} className="border-b last:border-0" data-testid={`dashboard-order-${order.id}`}>
                                  <td className="py-2 pr-3 font-medium">#{order.id}</td>
                                  <td className="py-2 pr-3">
                                    <Badge className={`rounded-full text-xs ${getStatusColor(order.paymentStatus)}`}>
                                      {getStatusLabel(order.paymentStatus)}
                                    </Badge>
                                  </td>
                                  <td className="py-2 pr-3">
                                    <span className="font-semibold">R$ {parseFloat(order.totalAmount).toFixed(2).replace(".", ",")}</span>
                                    {order.paymentStatus === "PAGAMENTO_PARCIAL" && (
                                      <div className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                                        Pago: R$ {parseFloat(order.paidAmount || "0").toFixed(2).replace(".", ",")}
                                      </div>
                                    )}
                                  </td>
                                  <td className="py-2">
                                    {isPaidStatus && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="rounded-lg text-xs"
                                        onClick={() => window.open(`/pedido/${order.id}`, "_blank")}
                                        data-testid={`button-view-detail-${order.id}`}
                                      >
                                        Ver detalhes
                                      </Button>
                                    )}
                                    {order.paymentStatus === "PAGAMENTO_PARCIAL" && order.asaasPaymentUrl && (
                                      <Button
                                        size="sm"
                                        className="rounded-lg text-xs"
                                        style={{ backgroundColor: themeColor }}
                                        onClick={() => window.open(order.asaasPaymentUrl, "_blank")}
                                        data-testid={`button-pay-diff-${order.id}`}
                                      >
                                        Pagar diferença
                                      </Button>
                                    )}
                                    {!isPaidStatus && !isCancelledStatus && order.paymentStatus !== "PAGAMENTO_PARCIAL" && order.asaasPaymentUrl && (
                                      <Button
                                        size="sm"
                                        className="rounded-lg text-xs"
                                        style={{ backgroundColor: themeColor }}
                                        onClick={() => window.open(order.asaasPaymentUrl, "_blank")}
                                        data-testid={`button-pay-order-${order.id}`}
                                      >
                                        Ir para Pagamento
                                      </Button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <Button
                        className="w-full rounded-lg"
                        variant="outline"
                        onClick={loadExistingOrder}
                        data-testid="button-edit-existing"
                      >
                        <ArrowRight className="w-4 h-4 mr-2" />
                        Editar pedido
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {customerLookedUp && (
                  <Button
                    className="w-full rounded-lg h-12"
                    style={{ backgroundColor: themeColor }}
                    onClick={() => {
                      if (cacheRestored && step !== "cpf") return;
                      setStep(customerData && gender ? "jerseys" : "info");
                    }}
                    data-testid="button-next-step"
                  >
                    <ArrowRight className="w-4 h-4 mr-2" />
                    {cpfDashboardOrders && cpfDashboardOrders.length > 0 ? "Fazer novo pedido" : "Continuar"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
          {renderPrivacyFooter()}
        </div>
        {renderWhatsApp()}
      </div>
    );
  }

  if (step === "info") {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-1.5 w-full" style={{ backgroundColor: themeColor }} />
        {renderSponsorsMobileBar()}
        <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
          {renderHeader()}

          <Card className="rounded-xl shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Informações Pessoais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cpf-display">
                  <CreditCard className="w-3.5 h-3.5 inline mr-1.5" />
                  CPF
                </Label>
                <Input
                  id="cpf-display"
                  value={cpf}
                  disabled
                  className="rounded-lg bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="athleteName">
                  <User className="w-3.5 h-3.5 inline mr-1.5" />
                  Nome Completo *
                </Label>
                <Input
                  id="athleteName"
                  value={athleteName}
                  onChange={e => setAthleteName(e.target.value.toUpperCase())}
                  placeholder="Seu nome completo"
                  className="rounded-lg"
                  data-testid="input-athlete-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">
                  <Phone className="w-3.5 h-3.5 inline mr-1.5" />
                  Telefone / WhatsApp *
                </Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={e => setPhone(formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  className="rounded-lg"
                  data-testid="input-phone"
                />
              </div>
              <div className="space-y-2">
                <Label>Gênero *</Label>
                <RadioGroup value={gender} onValueChange={setGender} className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="male" id="male" data-testid="radio-male" />
                    <Label htmlFor="male" className="cursor-pointer">Masculino</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="female" id="female" data-testid="radio-female" />
                    <Label htmlFor="female" className="cursor-pointer">Feminino</Label>
                  </div>
                </RadioGroup>
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="rounded-lg" onClick={() => setStep("cpf")} data-testid="button-back-info">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                </Button>
                <Button
                  className="flex-1 rounded-lg"
                  style={{ backgroundColor: themeColor }}
                  onClick={() => setStep("jerseys")}
                  disabled={!athleteName || !phone || !gender}
                  data-testid="button-next-jerseys"
                >
                  Selecionar Uniformes <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
          {renderPrivacyFooter()}
        </div>
        {renderWhatsApp()}
      </div>
    );
  }

  if (step === "summary") {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-1.5 w-full" style={{ backgroundColor: themeColor }} />
        {renderSponsorsMobileBar()}
        <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
          {renderHeader()}

          <Card className="rounded-xl shadow-md">
            <CardHeader>
              <CardTitle className="text-lg" data-testid="text-order-summary-title">Resumo do Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <p><strong>Nome:</strong> {athleteName}</p>
                <p><strong>CPF:</strong> {cpf}</p>
                <p><strong>Telefone:</strong> {phone}</p>
              </div>

              {!gender && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium text-red-800">Selecione o sexo para continuar:</p>
                  <RadioGroup value={gender} onValueChange={setGender} className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="male" id="summary-male" />
                      <Label htmlFor="summary-male" className="cursor-pointer text-sm">Masculino</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="female" id="summary-female" />
                      <Label htmlFor="summary-female" className="cursor-pointer text-sm">Feminino</Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              <div className="divide-y">
                {orderSummaryItems.map((item, i) => (
                  <div key={i} className="py-3 first:pt-0 last:pb-0" data-testid={`summary-item-${i}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{item.jerseyName}</p>
                        <p className="text-sm text-muted-foreground">
                          Tamanho: {item.size} · Número: {item.number} · Nome: {item.nickname}
                        </p>
                      </div>
                      {item.unitPrice > 0 && (
                        <span className="font-medium text-sm whitespace-nowrap ml-4">
                          R$ {item.unitPrice.toFixed(2).replace(".", ",")}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {cartSummary.totalPrice > 0 && (
                <div className="flex justify-between items-center pt-4 border-t">
                  <span className="font-semibold text-lg">Total</span>
                  <span className="font-bold text-xl" style={{ color: themeColor }} data-testid="text-summary-total">
                    R$ {cartSummary.totalPrice.toFixed(2).replace(".", ",")}
                  </span>
                </div>
              )}

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  O pedido só será confirmado após a realização do pagamento.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  className="w-full rounded-lg"
                  style={{ backgroundColor: themeColor }}
                  onClick={() => submitMutation.mutate()}
                  disabled={submitMutation.isPending || !gender}
                  data-testid="button-confirm-pay-now"
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  {submitMutation.isPending ? "Processando..." : "Confirmar Pedido"}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full rounded-lg"
                  onClick={() => setStep("jerseys")}
                  data-testid="button-back-to-form"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Voltar ao Formulário
                </Button>
              </div>
            </CardContent>
          </Card>
          {renderPrivacyFooter()}
        </div>
        {renderWhatsApp()}
      </div>
    );
  }

  const renderJerseyCard = (jersey: Jersey, jerseyIndex: number) => {
    const order = orders[jerseyIndex];
    if (!order) return null;
    const sizes = getSizes(jersey.genderType, jersey.audienceType);
    const unitPrice = parseFloat(jersey.price) || 0;
    const isConfiguring = configJersey === jerseyIndex;
    const isInCart = order.quantity > 0;

    return (
      <Card
        key={jersey.id}
        className={`rounded-xl overflow-hidden transition-all ${isInCart ? "shadow-md ring-2 ring-primary/20" : "shadow-sm hover:shadow-md"}`}
        data-testid={`card-jersey-order-${jersey.id}`}
      >
        <div className="h-1" style={{ backgroundColor: isInCart ? themeColor : "transparent" }} />
        <CardContent className="p-0">
          <div className="flex items-center gap-4 p-4">
            {jersey.imageUrl ? (
              <button
                type="button"
                className="relative group flex-shrink-0 rounded-xl overflow-hidden"
                onClick={() => {
                  const allImages = [jersey.imageUrl!, ...(jersey.galleryImages || [])];
                  const orderData = orders[jerseyIndex];
                  const item = orderData?.items?.[0];
                  if (item) {
                    const num = item.number === "other" ? item.customNumber : item.number;
                    setImageModalPreview({ number: num || "", nickname: item.nickname || "" });
                  } else {
                    setImageModalPreview(null);
                  }
                  setImageModalJersey(jersey);
                }}
                data-testid={`button-zoom-jersey-${jersey.id}`}
              >
                <img src={jersey.imageUrl} alt={jersey.name} className="w-20 h-20 rounded-xl object-cover shadow-sm" loading="lazy" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                </div>
              </button>
            ) : (
              <div className="w-20 h-20 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: themeColor + "10" }}>
                <Shirt className="w-10 h-10" style={{ color: themeColor }} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg">{jersey.name}</h3>
              <p className="text-sm text-muted-foreground">
                {jersey.modelType} · {jersey.genderType === "male" ? "Masculino" : jersey.genderType === "female" ? "Feminino" : "Unissex"}
                {jersey.audienceType === "child" ? " · Infantil" : jersey.audienceType === "adult" ? " · Adulto" : jersey.audienceType === "mixed" ? " · Misto" : ""}
              </p>
              {unitPrice > 0 && (
                <p className="font-bold text-lg mt-1" style={{ color: themeColor }}>
                  R$ {unitPrice.toFixed(2).replace(".", ",")}
                </p>
              )}
            </div>
            <div className="flex-shrink-0">
              {isInCart ? (
                <Badge className="bg-emerald-100 text-emerald-800 rounded-full">{order.quantity}x</Badge>
              ) : null}
            </div>
          </div>

          {!isConfiguring && !isInCart && (
            <div className="px-4 pb-4">
              <Button
                className="w-full rounded-lg"
                style={{ backgroundColor: themeColor }}
                onClick={() => {
                  updateOrderQuantity(jerseyIndex, 1);
                  setConfigJersey(jerseyIndex);
                }}
                data-testid={`button-select-jersey-${jerseyIndex}`}
              >
                <Plus className="w-4 h-4 mr-2" />
                Selecionar
              </Button>
            </div>
          )}

          {!isConfiguring && isInCart && (
            <div className="px-4 pb-4 flex gap-2">
              <Button
                variant="outline"
                className="flex-1 rounded-lg"
                onClick={() => setConfigJersey(jerseyIndex)}
                data-testid={`button-edit-jersey-${jerseyIndex}`}
              >
                Editar
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="rounded-lg text-destructive hover:bg-destructive/10"
                onClick={() => {
                  updateOrderQuantity(jerseyIndex, 0);
                  setConfigJersey(null);
                }}
                data-testid={`button-remove-jersey-${jerseyIndex}`}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          {isConfiguring && (
            <div className="border-t bg-muted/30 p-4 space-y-4">
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-lg h-9 w-9"
                    onClick={() => {
                      if (order.quantity > 1) updateOrderQuantity(jerseyIndex, order.quantity - 1);
                    }}
                    disabled={order.quantity <= 1}
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                  <span className="font-semibold text-lg w-8 text-center" data-testid={`text-qty-${jerseyIndex}`}>{order.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-lg h-9 w-9"
                    onClick={() => updateOrderQuantity(jerseyIndex, order.quantity + 1)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {order.items.map((item, itemIndex) =>
                renderJerseyItemBlock(jerseyIndex, itemIndex, item, jersey, sizes)
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="rounded-lg"
                  onClick={() => {
                    updateOrderQuantity(jerseyIndex, 0);
                    setConfigJersey(null);
                  }}
                  data-testid={`button-cancel-jersey-${jerseyIndex}`}
                >
                  <X className="w-4 h-4 mr-2" /> Remover
                </Button>
                <Button
                  className="flex-1 rounded-lg"
                  style={{ backgroundColor: themeColor }}
                  onClick={() => setConfigJersey(null)}
                  data-testid={`button-add-cart-${jerseyIndex}`}
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  {isInCart ? "Salvar alterações" : "Adicionar ao carrinho"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="h-1.5 w-full" style={{ backgroundColor: themeColor }} />
      {renderSponsorsMobileBar()}
      {renderSponsorsSidebar()}

      <div className={`max-w-2xl mx-auto px-4 py-8 space-y-6 lg:max-w-3xl lg:pr-8 lg:mr-[340px] ${sponsorsData && sponsorsData.length > 0 ? 'lg:ml-[200px]' : ''}`}>
        {renderHeader()}
        {renderSponsorsTop()}

        {editingExisting && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3" data-testid="banner-editing">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-800 font-medium">Você está editando um pedido existente.</p>
          </div>
        )}

        {cacheRestored && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3" data-testid="banner-cache-restored">
            <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <p className="text-sm text-blue-800">Restauramos seu pedido em andamento.</p>
          </div>
        )}

        {jerseyList && jerseyList.length === 0 && (
          <Card className="rounded-xl shadow-md">
            <CardContent className="pt-8 pb-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Shirt className="w-7 h-7 text-muted-foreground/50" />
              </div>
              <p className="font-medium text-foreground mb-1">Nenhuma camiseta disponível</p>
              <p className="text-sm text-muted-foreground">O administrador ainda não adicionou camisetas a este formulário.</p>
            </CardContent>
          </Card>
        )}

        {form.tryonEnabled && jerseyList && jerseyList.length > 0 && (
          <Button
            variant="outline"
            className="w-full rounded-xl"
            onClick={() => setShowTryOn(true)}
            data-testid="button-tryon"
          >
            <Shirt className="w-4 h-4 mr-2" />
            Testar uniforme em mim
          </Button>
        )}

        <TryOnModal open={showTryOn} onOpenChange={setShowTryOn} jerseys={jerseyList || []} />

        {jerseyList && jerseyList.map((jersey, jerseyIndex) => renderJerseyCard(jersey, jerseyIndex))}

        {hasActiveOrders && !allItemsComplete && (
          <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5" data-testid="text-validation-warning">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Preencha tamanho, número e apelido de todas as camisetas selecionadas.</span>
          </div>
        )}

        <Button
          className="w-full rounded-xl shadow-md"
          size="lg"
          onClick={() => {
            if (!customerData && (!athleteName || !phone || !gender)) {
              setStep("info");
              return;
            }
            setStep("summary");
          }}
          disabled={!hasActiveOrders || !allItemsComplete}
          style={{ backgroundColor: themeColor }}
          data-testid="button-submit"
        >
          <ArrowRight className="w-4 h-4 mr-2" />
          {existingResponseId ? "Atualizar Pedido" : "Prosseguir para Pagamento"}
        </Button>

        <div className="h-20 lg:hidden" />
      </div>

      {hasActiveOrders && cartSummary.items.length > 0 && (
        <>
          <div className="hidden lg:block fixed top-0 right-0 w-[320px] h-screen bg-card border-l shadow-lg overflow-y-auto" data-testid="cart-desktop">
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-lg">Resumo do Pedido</h3>
              </div>
              <div className="space-y-3">
                {cartSummary.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-border/50">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-muted-foreground">{item.qty}x</p>
                    </div>
                    {item.unitPrice > 0 && (
                      <p className="font-medium">R$ {item.price.toFixed(2).replace(".", ",")}</p>
                    )}
                  </div>
                ))}
              </div>
              <div className="pt-2 border-t space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Quantidade total</span>
                  <span>{cartSummary.totalJerseys} camiseta{cartSummary.totalJerseys !== 1 ? "s" : ""}</span>
                </div>
                {cartSummary.totalPrice > 0 && (
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total</span>
                    <span style={{ color: themeColor }}>R$ {cartSummary.totalPrice.toFixed(2).replace(".", ",")}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50" data-testid="cart-mobile">
            <div
              className={`bg-card border-t shadow-2xl transition-all duration-300 ${
                cartOpen ? "max-h-[60vh] overflow-y-auto" : "max-h-16"
              }`}
            >
              <button
                type="button"
                onClick={() => setCartOpen(!cartOpen)}
                className="w-full px-4 py-3 flex items-center justify-between"
                data-testid="button-toggle-cart"
              >
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">
                    {cartSummary.totalJerseys} camiseta{cartSummary.totalJerseys !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {cartSummary.totalPrice > 0 && (
                    <span className="font-bold" style={{ color: themeColor }}>
                      R$ {cartSummary.totalPrice.toFixed(2).replace(".", ",")}
                    </span>
                  )}
                  {cartOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </div>
              </button>
              {cartOpen && (
                <div className="px-4 pb-4 space-y-3">
                  <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Resumo do Pedido
                  </div>
                  {cartSummary.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-border/50">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-muted-foreground">{item.qty}x</p>
                      </div>
                      {item.unitPrice > 0 && (
                        <p className="font-medium">R$ {item.price.toFixed(2).replace(".", ",")}</p>
                      )}
                    </div>
                  ))}
                  {cartSummary.totalPrice > 0 && (
                    <div className="flex justify-between font-semibold text-base pt-2 border-t">
                      <span>Total</span>
                      <span style={{ color: themeColor }}>R$ {cartSummary.totalPrice.toFixed(2).replace(".", ",")}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {showTimerDialog && (() => {
        const [jId, num] = showTimerDialog.split("-");
        const jerseyId = Number(jId);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="dialog-timer-expired">
            <div className="bg-card rounded-2xl p-6 max-w-sm mx-4 shadow-2xl space-y-4">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <h3 className="font-semibold text-lg">Tempo de reserva expirado</h3>
                <p className="text-sm text-muted-foreground">Você ainda está preenchendo o pedido?</p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 rounded-lg"
                  onClick={() => releaseReservation(jerseyId, num)}
                  data-testid="button-release-number"
                >
                  Liberar número
                </Button>
                <Button
                  className="flex-1 rounded-lg"
                  style={{ backgroundColor: themeColor }}
                  onClick={() => renewReservation(jerseyId, num)}
                  data-testid="button-continue-reservation"
                >
                  Continuar
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {renderWhatsApp()}

      <JerseyImageModal
        open={!!imageModalJersey}
        onClose={() => { setImageModalJersey(null); setImageModalPreview(null); }}
        images={imageModalJersey ? [imageModalJersey.imageUrl!, ...(imageModalJersey.galleryImages || [])].filter(Boolean) : []}
        jerseyName={imageModalJersey?.name || ""}
        description={imageModalJersey?.description}
        price={imageModalJersey ? (parseFloat(imageModalJersey.price) > 0 ? parseFloat(imageModalJersey.price).toFixed(2).replace(".", ",") : null) : null}
        themeColor={themeColor}
        previewNumber={imageModalPreview?.number}
        previewNickname={imageModalPreview?.nickname}
      />
    </div>
  );
}
