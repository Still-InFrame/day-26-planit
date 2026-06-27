"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/format";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler, Legend);

type Overview = {
  total_users: number;
  total_plans: number;
  total_activities: number;
  total_members: number;
  total_spend: number;
  plans_this_month: number;
  new_users_this_month: number;
  private_plans: number;
  settleup_plans: number;
  blocked_users: number;
  total_deletions: number;
  deletions_this_month: number;
};
type Monthly = {
  labels: string[];
  plans: number[];
  new_users: number[];
  deletions: number[];
  cumulative_users: number[];
};
type AdminUser = {
  user_id: string;
  name: string | null;
  email: string;
  created_at: string;
  blocked: boolean;
  role: "user" | "admin" | "superadmin";
  plans_created: number;
  memberships: number;
  is_self: boolean;
  can_manage: boolean;
  can_promote: boolean;
  can_demote: boolean;
};

const chartOpts = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: true, labels: { boxWidth: 12, usePointStyle: true } } },
  scales: {
    y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "#ece9f5" } },
    x: { grid: { display: false } },
  },
} as const;

export function AdminDashboard({
  overview,
  monthly,
  users,
}: {
  overview: Overview;
  monthly: Monthly;
  users: AdminUser[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function toggleBlock(u: AdminUser) {
    setBusy(u.user_id);
    await supabase.rpc("planit_admin_set_blocked", { _user_id: u.user_id, _blocked: !u.blocked });
    setBusy(null);
    router.refresh();
  }
  async function del(u: AdminUser) {
    setBusy(u.user_id);
    await supabase.rpc("planit_admin_delete_user", { _user_id: u.user_id });
    setBusy(null);
    setConfirmDelete(null);
    router.refresh();
  }
  async function setRole(u: AdminUser, role: "user" | "admin") {
    setBusy(u.user_id);
    await supabase.rpc("planit_admin_set_role", { _user_id: u.user_id, _new_role: role });
    setBusy(null);
    router.refresh();
  }

  const plansData = {
    labels: monthly.labels,
    datasets: [
      {
        label: "Plans created",
        data: monthly.plans,
        borderColor: "#6366f1",
        backgroundColor: "rgba(99,102,241,0.12)",
        fill: true,
        tension: 0.35,
        pointRadius: 3,
      },
    ],
  };
  const usersData = {
    labels: monthly.labels,
    datasets: [
      {
        label: "Total users",
        data: monthly.cumulative_users,
        borderColor: "#ec4899",
        backgroundColor: "rgba(236,72,153,0.12)",
        fill: true,
        tension: 0.35,
        pointRadius: 3,
      },
      {
        label: "New users",
        data: monthly.new_users,
        borderColor: "#10b981",
        backgroundColor: "rgba(16,185,129,0)",
        fill: false,
        tension: 0.35,
        pointRadius: 3,
        borderDash: [5, 4],
      },
      {
        label: "Deletions",
        data: monthly.deletions,
        borderColor: "#f43f5e",
        backgroundColor: "rgba(244,63,94,0)",
        fill: false,
        tension: 0.35,
        pointRadius: 3,
        borderDash: [2, 3],
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Kpi label="Users" value={overview.total_users} sub={`+${overview.new_users_this_month} this month`} />
        <Kpi label="Plans" value={overview.total_plans} sub={`+${overview.plans_this_month} this month`} />
        <Kpi label="Activities" value={overview.total_activities} />
        <Kpi label="Tracked spend" value={money(overview.total_spend)} />
        <Kpi label="Seats" value={overview.total_members} />
        <Kpi
          label="Avg plans / user"
          value={overview.total_users ? (overview.total_plans / overview.total_users).toFixed(1) : "0"}
        />
        <Kpi label="Private plans" value={overview.private_plans} />
        <Kpi label="Blocked" value={overview.blocked_users} tone={overview.blocked_users ? "rose" : undefined} />
        <Kpi
          label="Profile deletions"
          value={overview.total_deletions}
          sub={`${overview.deletions_this_month} this month`}
          tone={overview.total_deletions ? "rose" : undefined}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Plans created per month">
          <Line data={plansData} options={chartOpts} />
        </ChartCard>
        <ChartCard title="Users month over month">
          <Line data={usersData} options={chartOpts} />
        </ChartCard>
      </div>

      {/* Users */}
      <div className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-3 text-base font-bold">Users ({users.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="px-2 py-2">User</th>
                <th className="px-2 py-2">Role</th>
                <th className="px-2 py-2">Joined</th>
                <th className="px-2 py-2 text-right">Created</th>
                <th className="px-2 py-2 text-right">Member of</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id} className="border-t border-border">
                  <td className="px-2 py-2.5">
                    <div className="font-semibold">{u.name || "—"}{u.is_self && <span className="ml-1.5 rounded-full bg-indigo/10 px-1.5 py-0.5 text-[10px] font-bold text-indigo">YOU</span>}</div>
                    <div className="text-xs text-muted">{u.email}</div>
                  </td>
                  <td className="px-2 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        u.role === "superadmin"
                          ? "bg-pink/10 text-pink"
                          : u.role === "admin"
                            ? "bg-indigo/10 text-indigo"
                            : "bg-background text-muted"
                      }`}
                    >
                      {u.role === "superadmin" ? "Super" : u.role === "admin" ? "Admin" : "User"}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-muted">
                    {new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="tabular px-2 py-2.5 text-right">{u.plans_created}</td>
                  <td className="tabular px-2 py-2.5 text-right">{u.memberships}</td>
                  <td className="px-2 py-2.5">
                    {u.blocked ? (
                      <span className="rounded-full bg-rose/10 px-2 py-0.5 text-[11px] font-semibold text-rose">Blocked</span>
                    ) : (
                      <span className="rounded-full bg-emerald/10 px-2 py-0.5 text-[11px] font-semibold text-emerald">Active</span>
                    )}
                  </td>
                  <td className="px-2 py-2.5">
                    {confirmDelete === u.user_id ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-xs text-muted">Sure?</span>
                        <button onClick={() => del(u)} disabled={busy === u.user_id} className="rounded-lg bg-rose px-2 py-1 text-xs font-semibold text-white">
                          Delete
                        </button>
                        <button onClick={() => setConfirmDelete(null)} className="rounded-lg px-2 py-1 text-xs font-semibold text-muted">
                          No
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {u.can_promote && (
                          <button onClick={() => setRole(u, "admin")} disabled={busy === u.user_id} className="rounded-lg border border-indigo/30 bg-indigo/5 px-2.5 py-1 text-xs font-semibold text-indigo hover:bg-indigo/10">
                            Make admin
                          </button>
                        )}
                        {u.can_demote && (
                          <button onClick={() => setRole(u, "user")} disabled={busy === u.user_id} className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted hover:text-foreground">
                            Remove admin
                          </button>
                        )}
                        {u.can_manage && (
                          <>
                            <button
                              onClick={() => toggleBlock(u)}
                              disabled={busy === u.user_id}
                              className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-muted hover:text-foreground"
                            >
                              {u.blocked ? "Unblock" : "Block"}
                            </button>
                            <button
                              onClick={() => setConfirmDelete(u.user_id)}
                              className="rounded-lg border border-rose/30 bg-rose/5 px-2.5 py-1 text-xs font-semibold text-rose hover:bg-rose/10"
                            >
                              Delete
                            </button>
                          </>
                        )}
                        {!u.can_manage && !u.can_promote && !u.can_demote && (
                          <span className="text-xs text-muted">—</span>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">
          Delete removes the user&apos;s entire planit footprint (their plans cascade). It does
          not delete their shared sign-in account.
        </p>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3.5 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={`tabular mt-0.5 text-2xl font-bold ${tone === "rose" ? "text-rose" : ""}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted">{sub}</div>}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-border bg-surface p-4 shadow-sm">
      <h2 className="mb-3 text-base font-bold">{title}</h2>
      <div className="h-64">{children}</div>
    </div>
  );
}
