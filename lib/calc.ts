import { resolveName, type MemberRow, type ContributionRow, type ProfileRow } from "./types";

// All money math runs in integer cents to dodge float drift, then converts back.
const toCents = (n: number) => Math.round((Number(n) || 0) * 100);
const toDollars = (c: number) => c / 100;

export type MemberSummary = {
  member: MemberRow;
  name: string; // resolved display name (nickname or profile)
  contributed: number; // total this member paid that counts toward budget
  pointsPaid: number; // value this member paid in points (documented)
  budget: number;
  remaining: number; // budget - contributed  (negative => over budget)
  over: boolean;
  fairShare: number; // what they "should" pay (budget-proportional, or even split)
  delta: number; // contributed - fairShare  (positive => overpaid / owed back)
  fairnessPct: number; // share of grand total this member covered (0..1)
};

export type EventSummary = {
  perMember: MemberSummary[];
  grandTotal: number; // everything spent that counts toward budget
  totalBudget: number; // sum of payer budgets
  poolRemaining: number; // totalBudget - grandTotal
  payerCount: number;
  pointsTotal: number; // total value paid in points (documented)
  pointsAffectBudget: boolean;
};

// Guest-of-honor members are covered, non-paying: excluded from budgets,
// fair-share, and settle-up. Their cost is absorbed by the payers' budgets.
export function computeSummary(
  members: MemberRow[],
  contributions: ContributionRow[],
  profiles: Map<string, ProfileRow> = new Map(),
  pointsAffectBudget = false,
): EventSummary {
  const contribByMember = new Map<string, number>();
  const pointsByMember = new Map<string, number>();
  let grandTotalC = 0;
  let pointsTotalC = 0;
  for (const c of contributions) {
    const cents = toCents(c.amount);
    // Points are documented but excluded from the budget math unless opted in.
    if (c.is_points && !pointsAffectBudget) {
      pointsTotalC += cents;
      pointsByMember.set(c.member_id, (pointsByMember.get(c.member_id) ?? 0) + cents);
      continue;
    }
    if (c.is_points) pointsTotalC += cents;
    grandTotalC += cents;
    contribByMember.set(c.member_id, (contribByMember.get(c.member_id) ?? 0) + cents);
  }

  const payers = members.filter((m) => !m.is_guest_of_honor);
  const totalBudgetC = payers.reduce((s, m) => s + toCents(m.budget), 0);
  const payerCount = payers.length;

  // Fair share: proportional to budget. If no budgets are set yet, fall back
  // to an even split among payers so the UI isn't all-zeros on day one.
  const useEven = totalBudgetC <= 0;

  const perMember: MemberSummary[] = members.map((m) => {
    const contributedC = contribByMember.get(m.id) ?? 0;
    const budgetC = toCents(m.budget);
    const remainingC = budgetC - contributedC;

    let fairShareC = 0;
    if (!m.is_guest_of_honor && payerCount > 0) {
      fairShareC = useEven
        ? Math.round(grandTotalC / payerCount)
        : Math.round((budgetC / totalBudgetC) * grandTotalC);
    }

    return {
      member: m,
      name: resolveName(m, profiles),
      contributed: toDollars(contributedC),
      pointsPaid: toDollars(pointsByMember.get(m.id) ?? 0),
      budget: toDollars(budgetC),
      remaining: toDollars(remainingC),
      over: remainingC < 0,
      fairShare: toDollars(fairShareC),
      delta: toDollars(contributedC - fairShareC),
      fairnessPct: grandTotalC > 0 ? contributedC / grandTotalC : 0,
    };
  });

  return {
    perMember,
    grandTotal: toDollars(grandTotalC),
    totalBudget: toDollars(totalBudgetC),
    poolRemaining: toDollars(totalBudgetC - grandTotalC),
    payerCount,
    pointsTotal: toDollars(pointsTotalC),
    pointsAffectBudget,
  };
}

export type Transfer = { fromId: string; fromName: string; toId: string; toName: string; amount: number };

// Greedy minimum-cash-flow settle-up toward each payer's budget-proportional
// fair share. Debtors (underpaid) pay creditors (overpaid) until even.
export function settleUp(summary: EventSummary): Transfer[] {
  type Bal = { id: string; name: string; cents: number };
  const balances: Bal[] = summary.perMember
    .filter((s) => !s.member.is_guest_of_honor)
    .map((s) => ({ id: s.member.id, name: s.name, cents: toCents(s.delta) }));

  const creditors = balances.filter((b) => b.cents > 0).sort((a, b) => b.cents - a.cents);
  const debtors = balances.filter((b) => b.cents < 0).sort((a, b) => a.cents - b.cents);

  const transfers: Transfer[] = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const cr = creditors[ci];
    const db = debtors[di];
    const move = Math.min(cr.cents, -db.cents);
    if (move > 0) {
      transfers.push({
        fromId: db.id,
        fromName: db.name,
        toId: cr.id,
        toName: cr.name,
        amount: toDollars(move),
      });
    }
    cr.cents -= move;
    db.cents += move;
    if (cr.cents === 0) ci++;
    if (db.cents === 0) di++;
  }
  return transfers;
}
