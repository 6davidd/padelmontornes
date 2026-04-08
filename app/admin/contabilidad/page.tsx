"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { getDisplayName } from "../../../lib/display-name";

const CLUB_GREEN = "#0f5e2e";

type MemberRow = {
  user_id: string;
  full_name: string;
  alias: string | null;
  email: string | null;
  is_active: boolean;
  role: "member" | "admin" | "superadmin";
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
  const router = useRouter();

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
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        router.push("/login");
        return;
      }

      const me = await supabase
        .from("members")
        .select("role,is_active")
        .eq("user_id", user.id)
        .single();

      if (me.error || !me.data) {
        router.push("/");
        return;
      }

      if (!me.data.is_active || me.data.role !== "superadmin") {
        router.push("/");
        return;
      }

      await loadData(selectedMonth);
    }

    init();
  }, [router]);

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

    const membersRes = await supabase
      .from("members")
      .select("user_id,full_name,alias,email,is_active,role")
      .eq("is_active", true)
      .order("full_name", { ascending: true });

    if (membersRes.error) {
      setMsg(membersRes.error.message);
      setLoading(false);
      return;
    }

    const paymentsRes = await supabase
      .from("monthly_payments")
      .select("id,member_user_id,year,month,status,paid_at,marked_by,notes")
      .eq("year", year)
      .eq("month", month);

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

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const payload = {
        member_user_id: member.user_id,
        year,
        month,
        status: nextStatus,
        paid_at: nextStatus === "paid" ? new Date().toISOString() : null,
        marked_by: user.id,
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
    <div className="min-h-screen bg-gray-50 pb-40">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="bg-white rounded-3xl shadow-sm ring-1 ring-black/5 p-6 sm:p-8">
          <div className="flex flex-col gap-5">
            <div>
              <h1
                className="text-3xl sm:text-4xl font-bold"
                style={{ color: CLUB_GREEN }}
              >
                Contabilidad
              </h1>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Mes
                </label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 shadow-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Buscar socio
                </label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre, alias o email…"
                  className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder:text-gray-500 shadow-sm outline-none focus:ring-2 focus:ring-green-200 focus:border-gray-400"
                />
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
              <div className="text-lg font-bold text-gray-900 capitalize">
                {getMonthLabel(year, month)}
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
                  <div className="text-sm text-gray-500">Socios activos</div>
                  <div className="mt-1 text-2xl font-bold text-gray-900">
                    {stats.total}
                  </div>
                </div>

                <div className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
                  <div className="text-sm text-gray-500">Pagados</div>
                  <div className="mt-1 text-2xl font-bold text-green-700">
                    {stats.paid}
                  </div>
                </div>

                <div className="rounded-2xl bg-white p-4 ring-1 ring-black/5">
                  <div className="text-sm text-gray-500">Pendientes</div>
                  <div className="mt-1 text-2xl font-bold text-yellow-700">
                    {stats.pending}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {msg && (
            <div className="mt-4 rounded-2xl p-4 bg-yellow-50 ring-1 ring-yellow-200">
              <p className="text-sm text-yellow-900">{msg}</p>
            </div>
          )}

          {ok && (
            <div className="mt-4 rounded-2xl p-4 bg-green-50 ring-1 ring-green-200">
              <p className="text-sm text-green-900">{ok}</p>
            </div>
          )}
        </div>

        {loading ? (
          <div className="bg-white rounded-3xl shadow-sm ring-1 ring-black/5 p-5 text-gray-700">
            Cargando contabilidad...
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm ring-1 ring-black/5 p-6 text-center text-gray-700">
            No hay socios para mostrar.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredMembers.map((member) => {
              const cleanAlias = member.alias?.trim() || "";
              const hasAlias = cleanAlias.length > 0;
              const titleName = hasAlias ? cleanAlias : member.full_name || "—";
              const payment = paymentMap.get(member.user_id);
              const isPaid = payment?.status === "paid";
              const isSaving = savingId === member.user_id;

              return (
                <div
                  key={member.user_id}
                  className="bg-white rounded-3xl shadow-sm ring-1 ring-black/5 p-5"
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
                          "w-full sm:w-auto rounded-2xl px-5 py-3 font-semibold shadow-sm transition active:scale-[0.99] disabled:opacity-70",
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

      <div className="fixed bottom-4 left-0 right-0 z-40 px-4">
        <div className="max-w-4xl mx-auto">
          <a
            href="/admin"
            className="block w-full rounded-3xl py-4 text-center font-semibold text-white shadow-lg active:scale-[0.99] transition"
            style={{ backgroundColor: CLUB_GREEN }}
          >
            Panel administrador
          </a>
        </div>
      </div>
    </div>
  );
}