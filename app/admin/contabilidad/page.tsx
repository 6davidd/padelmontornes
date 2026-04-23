"use client";

import { useEffect, useMemo, useState } from "react";
import type { MemberRole } from "@/lib/auth-shared";
import { getCurrentMember } from "@/lib/client-current-member";
import { supabase } from "../../../lib/supabase";
import { getDisplayName } from "../../../lib/display-name";
import { PageHeaderCard } from "../../_components/PageHeaderCard";

const CLUB_GREEN = "#0f5e2e";

type MemberRow = {
  user_id: string;
  full_name: string;
  alias: string | null;
  email: string | null;
  is_active: boolean;
  role: MemberRole;
};

type MonthlyPaymentRow = {
  id: number;
  member_user_id: string;
  year: number;
  month: number;
  status: "pending" | "paid";
  paid_at: string | null;
  marked_by: string | null;
  notes: string | null;
};

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function PaymentBadge({ paid }: { paid: boolean }) {
  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
        paid
          ? "border-green-200 bg-green-50 text-green-800"
          : "border-yellow-200 bg-yellow-50 text-yellow-800"
      )}
    >
      {paid ? "Pagado" : "Pendiente"}
    </span>
  );
}

function formatMonthValue(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function parseMonthValue(value: string) {
  const [yearStr, monthStr] = value.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);

  return {
    year,
    month,
  };
}

function getMonthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function formatPaidAt(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AdminContabilidadPage() {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(formatMonthValue(today));

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [payments, setPayments] = useState<MonthlyPaymentRow[]>([]);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      await loadData(selectedMonth);
    }

    init();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadData(selectedMonth);
    }
  }, [selectedMonth]);

  async function loadData(monthValue: string) {
    setMsg(null);
    setOk(null);
    setLoading(true);

    const { year, month } = parseMonthValue(monthValue);

    const [membersRes, paymentsRes] = await Promise.all([
      supabase
        .from("members")
        .select("user_id,full_name,alias,email,is_active,role")
        .eq("is_active", true)
        .order("full_name", { ascending: true }),
      supabase
        .from("monthly_payments")
        .select("id,member_user_id,year,month,status,paid_at,marked_by,notes")
        .eq("year", year)
        .eq("month", month),
    ]);

    if (membersRes.error) {
      setMsg(membersRes.error.message);
      setLoading(false);
      return;
    }

    if (paymentsRes.error) {
      setMsg(paymentsRes.error.message);
      setLoading(false);
      return;
    }

    setMembers((membersRes.data ?? []) as MemberRow[]);
    setPayments((paymentsRes.data ?? []) as MonthlyPaymentRow[]);
    setLoading(false);
  }

  const { year, month } = useMemo(
    () => parseMonthValue(selectedMonth),
    [selectedMonth]
  );

  const paymentMap = useMemo(() => {
    const map = new Map<string, MonthlyPaymentRow>();

    for (const payment of payments) {
      map.set(payment.member_user_id, payment);
    }

    return map;
  }, [payments]);

  const filteredMembers = useMemo(() => {
    const sorted = [...members].sort((a, b) => {
      const aPaid = paymentMap.get(a.user_id)?.status === "paid";
      const bPaid = paymentMap.get(b.user_id)?.status === "paid";

      if (aPaid !== bPaid) return aPaid ? 1 : -1;

      const an = getDisplayName(a).toLocaleLowerCase("es-ES");
      const bn = getDisplayName(b).toLocaleLowerCase("es-ES");
      return an.localeCompare(bn, "es-ES");
    });

    const term = search.trim().toLocaleLowerCase("es-ES");
    if (!term) return sorted;

    return sorted.filter((member) => {
      const displayName = getDisplayName(member).toLocaleLowerCase("es-ES");
      const fullName = (member.full_name ?? "").toLocaleLowerCase("es-ES");
      const alias = (member.alias ?? "").toLocaleLowerCase("es-ES");
      const email = (member.email ?? "").toLocaleLowerCase("es-ES");

      return (
        displayName.includes(term) ||
        fullName.includes(term) ||
        alias.includes(term) ||
        email.includes(term)
      );
    });
  }, [members, paymentMap, search]);

  const stats = useMemo(() => {
    const total = members.length;
    const paid = members.filter(
      (member) => paymentMap.get(member.user_id)?.status === "paid"
    ).length;
    const pending = total - paid;

    return { total, paid, pending };
  }, [members, paymentMap]);

  async function togglePayment(member: MemberRow) {
    setMsg(null);
    setOk(null);
    setSavingId(member.user_id);

    try {
      const existing = paymentMap.get(member.user_id);
      const nextStatus: "pending" | "paid" =
        existing?.status === "paid" ? "pending" : "paid";

      const currentMember = await getCurrentMember();

      if (!currentMember) {
        setMsg("No hay sesión válida. Vuelve a iniciar sesión.");
        return;
      }

      const payload = {
        member_user_id: member.user_id,
        year,
        month,
        status: nextStatus,
        paid_at: nextStatus === "paid" ? new Date().toISOString() : null,
        marked_by: currentMember.user_id,
      };

      let error: string | null = null;

      if (existing) {
        const updateRes = await supabase
          .from("monthly_payments")
          .update(payload)
          .eq("id", existing.id)
          .select(
            "id,member_user_id,year,month,status,paid_at,marked_by,notes"
          )
          .single();

        if (updateRes.error) {
          error = updateRes.error.message;
        } else if (updateRes.data) {
          setPayments((prev) =>
            prev.map((p) => (p.id === existing.id ? updateRes.data : p))
          );
        }
      } else {
        const insertRes = await supabase
          .from("monthly_payments")
          .insert(payload)
          .select(
            "id,member_user_id,year,month,status,paid_at,marked_by,notes"
          )
          .single();

        if (insertRes.error) {
          error = insertRes.error.message;
        } else if (insertRes.data) {
          setPayments((prev) => [...prev, insertRes.data]);
        }
      }

      if (error) {
        setMsg(error);
        setSavingId(null);
        return;
      }

      setOk(
        nextStatus === "paid"
          ? `${getDisplayName(member)} marcado como pagado.`
          : `${getDisplayName(member)} marcado como pendiente.`
      );
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Error inesperado.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-gray-50 pb-8">
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-6 sm:px-6 sm:py-8">
        <PageHeaderCard title="Contabilidad" contentClassName="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="min-w-0">
                <label className="mb-2 block text-sm font-semibold text-gray-900">
                  Mes
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="block w-full min-w-0 max-w-full appearance-none rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-green-200"
                />
              </div>

              <div className="min-w-0">
                <label className="mb-2 block text-sm font-semibold text-gray-900">
                  Buscar socio
                </label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre, alias o email…"
                  className="block w-full min-w-0 max-w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder:text-gray-500 shadow-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-green-200"
                />
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
              <div className="text-lg font-bold capitalize text-gray-900">
                {getMonthLabel(year, month)}
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
                <div className="min-w-0 rounded-2xl bg-white px-3 py-4 text-center ring-1 ring-black/5 sm:p-4">
                  <div className="text-xs text-gray-500 sm:text-sm">Socios activos</div>
                  <div className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">
                    {stats.total}
                  </div>
                </div>

                <div className="min-w-0 rounded-2xl bg-white px-3 py-4 text-center ring-1 ring-black/5 sm:p-4">
                  <div className="text-xs text-gray-500 sm:text-sm">Pagados</div>
                  <div className="mt-1 text-xl font-bold text-green-700 sm:text-2xl">
                    {stats.paid}
                  </div>
                </div>

                <div className="min-w-0 rounded-2xl bg-white px-3 py-4 text-center ring-1 ring-black/5 sm:p-4">
                  <div className="text-xs text-gray-500 sm:text-sm">Pendientes</div>
                  <div className="mt-1 text-xl font-bold text-yellow-700 sm:text-2xl">
                    {stats.pending}
                  </div>
                </div>
              </div>
            </div>

          {msg && (
            <div className="mt-4 rounded-2xl bg-yellow-50 p-4 ring-1 ring-yellow-200">
              <p className="text-sm text-yellow-900">{msg}</p>
            </div>
          )}

          {ok && (
            <div className="mt-4 rounded-2xl bg-green-50 p-4 ring-1 ring-green-200">
              <p className="text-sm text-green-900">{ok}</p>
            </div>
          )}
        </PageHeaderCard>

        {loading ? (
          <div className="rounded-3xl bg-white p-5 text-gray-700 shadow-sm ring-1 ring-black/5">
            Cargando contabilidad...
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="rounded-3xl bg-white p-6 text-center text-gray-700 shadow-sm ring-1 ring-black/5">
            No hay socios para mostrar.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMembers.map((member) => {
              const cleanAlias = member.alias?.trim() || "";
              const hasAlias = cleanAlias.length > 0;
              const titleName = getDisplayName(member);
              const payment = paymentMap.get(member.user_id);
              const isPaid = payment?.status === "paid";
              const isSaving = savingId === member.user_id;

              return (
                <div
                  key={member.user_id}
                  className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-lg font-bold text-gray-900">
                          {titleName}
                        </div>
                        <PaymentBadge paid={isPaid} />
                      </div>

                      <div className="mt-3 space-y-1 text-sm text-gray-600">
                        {hasAlias && (
                          <div>
                            <span className="font-semibold text-gray-800">
                              Nombre real:
                            </span>{" "}
                            {member.full_name || "—"}
                          </div>
                        )}

                        <div className="break-all">
                          <span className="font-semibold text-gray-800">
                            Email:
                          </span>{" "}
                          {member.email || "—"}
                        </div>

                        <div>
                          <span className="font-semibold text-gray-800">
                            Último cambio:
                          </span>{" "}
                          {formatPaidAt(payment?.paid_at ?? null)}
                        </div>
                      </div>
                    </div>

                    <div className="sm:shrink-0">
                      <button
                        onClick={() => togglePayment(member)}
                        disabled={isSaving}
                        className={classNames(
                          "w-full rounded-2xl px-5 py-3 font-semibold shadow-sm transition active:scale-[0.99] disabled:opacity-70 sm:w-auto",
                          isPaid
                            ? "border border-yellow-200 bg-yellow-50 text-yellow-800 hover:bg-yellow-100"
                            : "text-white"
                        )}
                        style={
                          isPaid
                            ? undefined
                            : { backgroundColor: CLUB_GREEN }
                        }
                      >
                        {isSaving
                          ? "Guardando..."
                          : isPaid
                          ? "Marcar pendiente"
                          : "Marcar pagado"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}

