# Finance

> **Status:** Active
> **Last reviewed:** 2026-10-01

## Overview
Personal financial planning: users build *plans* (scenarios) with incomes,
expenses, and debts, then confirm monthly actuals so projections stay
calibrated. Health scoring and scenario comparison are part of this module.

## Routes
- `/portal/plans` — list of plans
- `/portal/plans/new` — create plan
- `/portal/plans/[id]` — plan detail + editor
- `/portal/plans/compare` — side-by-side scenario comparison

## Server actions — `/app/actions/`
- `finance-plans.ts` — CRUD + lifecycle for finance plans (create, update, delete, clone, set-as-main, `setPlanColorAction`) and projection calculations. `createPlanAction` stamps `balances_as_of` with the reader's today; `updatePlanAction`, `addPlanDebtAction` and `updatePlanDebtAction` ask `restateOpeningBalances` for a restatement when the edit changes an opening balance (see *Opening balances are dated*). Every action returns `ActionResult<X>`; every mutation calls `revalidatePlans()` (the `/portal/plans` layout **and** `/portal`, whose dashboard card shows the main plan)
- `finance-confirmations.ts` — save monthly confirmation snapshots and per-debt balance confirmations
- `dev-tools.ts` — `runDailySnapshotsAction` (admin-only): runs the daily finance + portfolio snapshot job on demand, surfaced via the dev drawer

## Services — `/lib/services/`
- `finance-plan-service.ts` — `listUserPlansWithLines` (every plan with its lines in five queries, for the list and compare pages); `updateIncome` / `updateExpense` / `updateDebt` / `updatePlan` throw a not-found error when no row on the caller's plan matched; `clonePlan` runs in one transaction and copies the per-month overrides re-pointed at the new lines (`cloneOverrides`; confirmations are not copied) and `balancesAsOf`. `createPlan(userId, data, today)` sets `balancesAsOf`; `updatePlan` / `addDebt` / `updateDebt` take an optional `PlanRestatement` and then write the whole restated set (plan balances, every debt's opening balance, `balancesAsOf`, and a same-day confirmation) in one transaction. `projectionOptionsFor(plan, userId)` is the ONE place projection options are assembled (portfolio value + weighted growth when included, auto-invest ROI, overrides, `asOf`); `projectPlanWithPortfolio` uses it. Re-exports the engine (`projectPlan`, `projectStateAt`, `compareDebtStrategies`, `deriveFinanceMood`) from `lib/finance/projection.ts`, and `setPlanColor` (colour-only update for the rail swatch)
- `finance-confirmation-service.ts` — confirmations + `autoConfirmSkippedPeriods` (cron baseline roll-forward). A confirmation is matched to the period that CONTAINS its day, never by exact key (see *Calculation semantics*)
- `finance-snapshot-service.ts` — `calibratePlan` (pure) / `buildCalibratedPlan`, `loadCalibratedView` (calibrate + project + today in one call), `loadPlanOverviews` (list/compare: every plan calibrated, projected and put on a timeline), snapshots, `restateOpeningBalances` (the restated opening set for an edit, or null when nothing changed), `getProjectedStateOnDay` (confirmation pre-fill), and `getFinanceMood` (request-cached; the main plan's calibrated outcome as a mascot pose)
- `interest-service.ts` — interest/ROI math (shared with [Portfolio](./portfolio.md))

## Pure finance maths — `/lib/finance/`
- `projection.ts` — the engine: `projectPlan`, `projectStateAt` (THE "today" figure), `compareDebtStrategies`, `deriveFinanceMood`. Client-safe, so the editor and the server run the same maths
- `schedule.ts` — `planOccurrences`: every dated occurrence of a plan's lines with overrides applied (skip / amount / reschedule, including moves into another month or period). The engine, the today figure, the sidebar breakdowns and the calendar all read it. `RESCHEDULE_MARGIN_MONTHS` / `rescheduleWithinReach` bound how far one occurrence may move; `monthYearOfKey` turns an occurrence's cadence month into its override key
- `opening-balances.ts` — `changesOpeningBalances` (does an edit change any opening balance, at cent precision) and `restateOpeningSet` (the set restated as of today)
- `period.ts` — accounting-period helpers (unchanged)
- `chart-series.ts` — `buildPlanTimeline` / `buildChartSeries` (real past as period closes + projection), `alignTodayPoint`, `buildCompareRows` (compare chart, joined by calendar month), `calendarTicks` (axis ticks on calendar months), `forecastKpiPoints` (the "Next" KPI; a plan that has not started yet gets its first close, no today marker and no Confirm), `milestoneCrossings`, and the one debt-free definition (`debtFreeMonthsFromNow`, `describeDebtFree`, `formatDebtFree`, `summaryDebtFree`)
- `scenario.ts` — `compareScenario` (scenario vs base at a shared period; payoff compared as dates)
- `dashboard.ts` — `buildDashboardFigures` for the dashboard card
- `debt-payments.ts` — `projectedDebtPayments` / `debtChipAmount`: the calendar's debt chips read the payments the projection made
- `table-rows.ts` — `densify` (first 12 rows + real Decembers)
- `amount-input.ts` — parses typed or pasted amounts ("$1,234.50") the way the server schema will, so the confirmation dialog shows per-field errors instead of a bare "Invalid input" toast
- `recurrence-label.ts` — `describeRecurrence`: the Setup tab's schedule column ("Every 6 months on the 12th"), never "Day 12 · monthly" for a six-monthly line
- `milestones.ts` — default milestone list
- Shared, outside the module: `lib/utils/date.ts` (`todayInTimeZone`, `calendarDayInTimeZone`, `earliestCalendarDay`, `TIME_ZONE_COOKIE`), `lib/utils/request-today.ts` (server: `getRequestToday` / `getRequestTimeZone` from the `tz` cookie), `hooks/use-time-zone-cookie.ts` (written by `AppHeader`), `lib/utils/format.ts` (`roundCents`, `moneySign`, `CENTS_EPSILON`)

## Schemas — `/schemas/`
- `finance.ts` — includes `planColorSchema` (colour-only update; restricted to a
  `var(--chart-N)` token or a 6-digit hex, since the value is written into a
  `style` attribute and an SVG `stroke`)
- `finance.ts`: `initialSavings` may be negative (a restated overdraft); `lineOverrideSchema` accepts a reschedule date in another month, up to `RESCHEDULE_MARGIN_MONTHS` (2) either side of the override's `monthYear`
- `finance.ts` also exports `recurrenceTypeSchema`, `planNameSchema`, `cloneFinancePlanSchema` / `CloneFinancePlanData`. Types are `…Data`; `…Input` (`z.input`) only for the schemas with defaults (create/update plan, income, expense, debt)
- `finance-snapshot.ts` — `financeSnapshotSourceSchema`
- `finance-confirmations.ts` — `confirmationSchema` / `ConfirmationData` (monthly actuals payload; shared by the action and `finance-confirmation-service`)

## Types — `/types/`
- `finance.ts` — includes `PlanSummary` (per-plan outcome shown on the rail),
  `FinanceMood` (mascot pose), `InvestmentMethodOption`, and the constant
  lists the unions derive from (`RECURRENCE_TYPES`, `DEBT_STRATEGIES`,
  `DEBT_PAYMENT_TYPES`, `OVERRIDE_SIDES`, `OVERRIDE_ACTIONS`)

## Components
`components/finance/` — plan editors, projection charts, confirmation dialogs,
strategy comparisons, the plans workspace
([`plans-workspace.tsx`](../../components/finance/plans-workspace.tsx)), and the
[`FinancialHealthDonut`](../../components/finance/financial-health-donut.tsx).

`/portal/plans` renders the workspace for **any** number of plans (a lone plan
still gets its projection curve). Rail rows drive the chart:

- the checkbox adds or removes a series;
- pointing at a row emphasizes it and the ⋯ menu pins that emphasis (the pin
  lives there so it is reachable on touch) — `ComparePlansChart` takes a
  `focusedPlanId` and fades every other line back;
- the colour swatch opens [`plan-color-picker.tsx`](../../components/finance/plan-color-picker.tsx):
  the theme palette plus a native custom input, saved through
  `setPlanColorAction`.

The metric tabs are **Net worth / Total debt** (Savings was dropped from both
the index and `compare/`). The horizon `Select` above the chart picks how many
periods are plotted
(default 24, of which `PAST_MONTHS` = 3 sit before today). Periods up to today
draw solid and everything after draws dashed — each plan is two `Line`s sharing
the boundary row, mirroring the single-plan chart in the same file. Today's row
gets the shared `TodayPulseDot`, rendered on the past series only (the future
series shares that row and would stack a second marker). The window
comes from `computeProjectionWindow`, whose `pastMonths` argument overrides its
default ~25%-of-range past slice.

The old single-plan card list (`plans-list.tsx`) was removed when the workspace
took over that case; its `PlanSummary` type now lives in `/types/finance.ts`.

On `/portal/plans/[id]` the chart is interactive both ways: **hovering** a
point previews that period's cash-flow figures in the sidebar, and **clicking**
it commits — any other period opens
[`period-compare-dialog.tsx`](../../components/finance/period-compare-dialog.tsx)
(that period's balances against today's, with deltas coloured by polarity — debt
going up is not an improvement), while clicking **today's** point opens the
`ConfirmationDialog` instead, since the present is something you record rather
than forecast. `ProjectionChart` exposes this as `onSelectIndex`, resolved from
the same `activeTooltipIndex` as the hover handler so the whole column is
clickable rather than the 4px dot.

**Layout notes (render-verified at 390 / 768 / 1024 / 1440, light and dark).**
- The editor's chart + sidebar split (3/4 + 1/4) starts at `xl`; at `lg` the
  two cards sit side by side at half width, because at 1024 the quarter-width
  sidebar was ~155px and clipped its figures. The sidebar is `xl:min-h-160`
  (it grows rather than clipping) and its first row is **Expenses & debt** —
  expenses plus debt minimums, deliberately not the Surplus breakdown's
  "Living expenses".
- Setup → Debts is a table; add and edit go through `DebtFormDialog` (which
  has the payment day the inline grid lacked).
- The calendar switches to compact pills below the `@2xl/cal` container
  width: tap a pill for the entry's menu, tap a date for the add menu. Drag to
  move is desktop-only; on a phone, move one occurrence through Edit.
- The chart's today point is labelled "Today <date>", and the projection table
  highlights the current period, because the table rows are period closes and
  the today figure is not.
- `PlanForm` takes `today` (the reader's, from the server) so a new plan's
  start month is the reader's month, not the server's UTC one.

The finance mascot ([`context-avatar.tsx`](../../components/portal/context-avatar.tsx))
is mounted by [`app/portal/plans/layout.tsx`](../../app/portal/plans/layout.tsx)
and posed by `getFinanceMood`, so it reads as a status glyph
(`idle` / `steady` / `thriving` / `strained`) rather than decoration. It is
gated on the `showContextAvatar` preference — see [Settings](./settings.md).

## DB tables — `db/schema.ts`
- `finance_plans` — user's financial scenarios. `balances_as_of` (date, nullable; migration `0052_faithful_hiroim`) is the calendar day the opening balances were last set on; the same migration dropped `finance_plans_initial_savings_chk` so a restated overdraft can be stored
- `finance_plan_incomes` — income line items
- `finance_plan_expenses` — expense line items
- `finance_plan_debts` — tracked debts within a plan
- `finance_plan_snapshots` — historical plan position snapshots
- `finance_plan_snapshot_debts` — per-debt balance breakdown for each snapshot
- `finance_plan_confirmations` — user-confirmed monthly actuals (`source`: `user` | `auto`)
- `finance_plan_debt_confirmations` — per-debt balance confirmations

## Notes
- Conventional Commits scope: `finance`
- **Logic audit (2026-09-11).** The confirmation dialog is mounted only while open, and `confirmedSavings` accepts a negative figure (deficits are carried; the DB check was dropped in migration 0051). The anchored calendar converts `periodRangeFor`'s UTC bounds to local days and opens on today's period; a "Move all" drop turns the line into a `monthly_day` rule. Period-0 snapshots include the portfolio and snapshots grow it at the weighted ROI. Confirming, creating and deleting plans revalidate `/portal`. (Superseded in places by the 2026-09-29 calculation audit below.)
- Cron job `/api/cron/daily` may write snapshots into this module — keep in sync with [Portfolio](./portfolio.md).
- All actions wrap their handler in `safe()` from `@/lib/actions/safe` so service errors translate to `{ success: false, error: "Action failed" }` for the client.
- `getPlanWithLines`, `listUserPlans`, `getMainPlan`, `getPortfolioValueForUser` and `getPortfolioWeightedMonthlyRoi` are wrapped in `React.cache()` so the dashboard cards, the plans layout and every projection on a plans page share one DB hit per request.
- **The chart's today point IS the Today KPI.** `projectStateAt(baseline, …, today)` (computed on the server, passed as `today`) is the day-aware position; `alignTodayPoint` puts it on the chart's today point, and the sidebar's Total debt, the confirmation pre-fill, the compare dialog's "from" and the dashboard tiles all read the same figure. The scenario ghost's today point is the base plan's own `projectStateAt`.
- `saveConfirmation` checks that every `debtBalances[].debtId` belongs to the plan before writing; a foreign debt id would otherwise feed another plan's calibration.
- `ProjectionChart` and `ComparePlansChart` are lazy-loaded via `next/dynamic({ ssr: false })` to keep recharts out of the initial bundle; `PlanCalendar` and `ProjectionTable` load the same way since neither is on screen until the reader switches view. `ComparePlansChart` memoises its derived series.
- **Chart = real past + forecast future.** `buildPlanTimeline` / `buildChartSeries` ([`lib/finance/chart-series.ts`](../../lib/finance/chart-series.ts)): periods that closed before today's come from **real snapshots** (solid), today's period onward from the calibrated **projection** (dashed). Every point means the same thing — the period's CLOSE: a snapshot stores the OPENING of the period it was taken in, which is the previous period's close, so it is plotted one period earlier (`snapshotClosePeriod`). Without snapshots the plan's own forecast stands in as the past only while the plan has never been confirmed (`simulatedPast`); once it has, the solid line is real or absent — never the old forecast. The window is exactly `horizonMonths` points; the End KPI is its last point and the Table view lists the projection rows the window covers, so header, chart and table end on the same period. `getRecentMonthlySnapshots` dedups per accounting period.
- **Every surface projects the calibrated plan.** The plan page, the plans list (`loadPlanOverviews`), the compare page, the dashboard card and the mascot all use `buildCalibratedPlan` (latest confirmation as the opening, on its day) with `projectionOptionsFor` — so they show the same figures. Calibration keeps the plan's own END date (`monthsAhead` is recomputed from the original last period), pins every-N-months lines without a "First month" to the original start month, and sets `asOf`. The raw `plan` is what the line/debt editors mutate.
- `app/portal/plans/loading.tsx`, `app/portal/plans/new/loading.tsx`, `app/portal/plans/compare/loading.tsx`, `app/portal/plans/[id]/loading.tsx`, `app/portal/plans/[id]/not-found.tsx`, and `app/portal/plans/error.tsx` give the routes a proper skeleton / 404 / error experience. The `[id]/loading.tsx` mirrors the PlanEditor silhouette (title/tabs header + the Overview hero: 3/4 main panel = default Graph view + the bottom view-switcher, beside the 1/4 gauge/cycle/strategy sidebar) so the swap to the real editor feels like content filling in rather than a layout shift.
- **Main plan**: each user has at most one plan with `is_main = TRUE` (enforced by a partial unique index in `finance_plans`). The Dashboard confirmation host and the `DashboardFinanceCard` both follow this flag — non-main plans never auto-prompt for monthly confirmation. `setMainPlanAction` flips the flag atomically; `createPlan` auto-sets the first plan as main; `deletePlan` promotes the next oldest plan when the main one is removed. The Plans list shows a Star next to the main plan's title with a "Set as main" item in each card's `…` menu, and the plan editor's Settings tab has a banner with the same toggle.
- **Period-anchored projections**: each entry in `projection.months` represents one accounting period anchored at `confirmationDayOfMonth` (e.g. day 15 → Jan 15–Feb 14, Feb 15–Mar 14, …). Day 31 clamps to month-end (Feb 28/29). `confirmationDayOfMonth === 0` (feature disabled) falls back to calendar months. Helpers live in [`lib/finance/period.ts`](../../lib/finance/period.ts) — `periodRangeFor`, `iteratePeriods`, `periodAnchorIso`, `periodLengthDays`, `isDateInPeriod`, `periodIndexForDate`, `monthsInPeriod`. Debt interest is day-weighted between payment dates and charges **one full monthly rate per period regardless of period length** (the segment fractions `days/daysInPeriod` always sum to 1; in the as-of period only the remaining days); `periodLengthDays` only sets *how* that fixed total is split around the payments. So a 28-day February period and a 31-day Jan-15→Feb-14 period accrue the **same** monthly interest, just apportioned differently.
- **Locating "today"**: "today" is the READER'S calendar day: `AppHeader` writes the browser's IANA zone to the `tz` cookie and server renders use `todayInTimeZone(getRequestTimeZone())` (fallback UTC). The cron knows no zone and uses the conservative rule below. Rows are located with `periodIndexForDate`, never a raw `year*12+month` subtraction. `projectStateAt` returns `before-start` (the plan starts later — its opening figures, labelled "Starts <month>"), `in-range`, or `after-end` (the last close).
- **Deficits are carried, not clipped**: when expenses + debt service exceed income, the savings line goes **negative** (carried as overdraft cash) so net worth reflects the real shortfall. Savings interest only accrues on a positive balance. Previously the deficit was clipped to 0, which over-stated the projection for users who outspend their income.
- **Snapshots record the period OPENING, not the projected close.** Daily / manual / confirmation snapshots store `computeStateAt(…, "open")` — the calibrated opening of the period containing the snapshot date (the previous close, or the confirmed balances). Past the horizon both edges return the LAST close. The cron writes **no** snapshot for a plan with confirmations off (anchor 0): every "open" state would be forecast, and snapshots are drawn as the real past.
- **Auto-confirm on skipped periods.** The daily cron calls `autoConfirmSkippedPeriods` *before* snapshotting: every CLOSED period after the latest confirmation's period with no confirmation **dated inside it** gets a `source: "auto"` row (keyed by its period start) recording its projected opening, chaining forward. The current period is never auto-confirmed. Periods are matched by containment, so rows saved under an older anchor day still count.
- **The cron's "today" is the earliest day on Earth.** No user's time zone is stored, so `createSnapshotForPlan` (source `system_cron`) takes `earliestCalendarDay(now)` — the calendar day in UTC−12 (`Etc/GMT+12`) — for everything that depends on a day boundary: which periods count as closed for `autoConfirmSkippedPeriods`, which period's opening the snapshot records (and the horizon clamp inside `computeStateAt`), the idempotency window and the stored snapshot date. A period is auto-confirmed only once it has closed everywhere, so nobody gets a period confirmed (or a forecast recorded as history) while it is still open where they live. With the cron at 00:00 UTC this lags a day: the period ending Sep 30 is auto-confirmed by the Oct 2 run. Manual and confirmation snapshots keep their own instant.
- The Calendar view (`components/finance/plan-calendar.tsx`, now one of the Overview switcher's three views — see below) ships with an **Anchored / Month** view toggle (default: Anchored). Anchored paginates by period and reads `Jan 15 – Feb 14, 2026`; Month shows the traditional calendar grid. In both views the anchor day's cell gets an amber border + soft background so the period boundary is always visible.
- Monthly confirmation prompt fires every day from the anchor day through the end of the period until a confirmation dated inside that period exists (matched by containment, not by key — so changing the anchor day doesn't re-prompt beside an existing one). A **user** confirmation row is keyed by the reader's calendar day it was made on (`financePlanConfirmations.confirmationMonth` keeps its historical name; rows saved before 2026-09-29 carry the period start), an **auto** row by the period start. The per-day localStorage dismiss key in `confirmation-prompt.tsx` suppresses re-shows within a day.
- The plan editor registers two **dev-drawer** helpers (Finance section, dev-only): *Force confirmation dialog* opens the real `ConfirmationDialog` for the current plan regardless of date/dismiss (saving still writes a real confirmation + recalibrates); *Run daily snapshot now* calls `runDailySnapshotsAction` to run the finance + portfolio snapshot cron job on demand. Both registered via `useState(() => helper)` for a stable identity (an inline object would loop `useRegisterDevTool`).
- The **plans list** (`/portal/plans`) projects every plan server-side so each surfaces its outcome — projected **net worth** (emerald/rose) and **debt-free** date (`N mo` / `No debt` / `Beyond horizon`). With ≥2 plans it renders `PlansWorkspace` (`components/finance/plans-workspace.tsx`): a Polymarket-style hero with the giant `ComparePlansChart` on the left (3/4, with Net worth / Total debt / Savings metric tabs) and a narrow right-hand **rail of plans** (1/4, stacked below the chart on mobile) whose checkboxes double as the chart's per-series toggles and which each carry the set-main / clone / delete menu and link to the plan. A single plan still renders the `PlansList` card. The dedicated `/portal/plans/compare` route still uses the full `CompareView` (toggle chips + ending-state cards). Follows the [`data-density-ui`](../../.github/skills/data-density-ui/SKILL.md) card anatomy.
- The **plan detail** Overview (`components/finance/plan-editor.tsx`) is the same Polymarket layout: the **3/4 main panel is a Graph / Table / Calendar view switcher** (segmented `ViewSwitcher` centered at the **bottom** of the panel, Polymarket-style; works as tabs on every device, plus horizontal swipe on touch via `useSwitcherSwipe` — the swipe is ignored when it starts inside a sideways-scrolling region like the table. The active view fades in on switch via a keyed `animate-in fade-in-0`; no horizontal slide, so nothing clips the active card's border/shadow. **Equal heights on lg**: the view box is fixed at `lg:h-[640px]` — graph flexes to fill, table/calendar scroll internally — and the sidebar column is `lg:min-h-[640px]` with the figures card `lg:flex-1`, so the sidebar's bottom edge lines up with the main panel across all three views; keep the two 640 values in sync). Graph and Table share a forecast header (Today / Next month / End-of-window KPIs + horizon presets); the Calendar view is `PlanCalendar` (which brings its own Card). Beside it, a **narrow right sidebar (1/4**, stacked below on mobile) holds two cards — (1) a condensed figures card: the `FinancialHealthDonut` on top, then the four cycle figures (income, expenses, total debt, surplus) as compact `StatRow`s (tap a row for its breakdown — a bottom sheet on mobile, a centered dialog on desktop, switched via `useIsMobile()`; the income / expense / debt-minimum lists show each line's **hit date within the current anchor period** (anchor→anchor, e.g. day 5 ⇒ Apr 5 – May 4, spanning two calendar months via `periodRangeFor` + `monthsInPeriod` + `isDateInPeriod`) as a small muted sub-line, and are **sorted chronologically**); and (2) a **Debt payoff strategy** card — the avalanche/snowball/none `StrategyBadge` (full-width row) + an expandable **stacked** `StrategyPicker`, moved out of the chart card so the chart stays clean. The monthly breakdown is the switcher's **Table** view (no longer a separate full-width card), and the **Calendar** view replaces the old top-level Calendar tab. The page header is just title + a single **Overview** tab (Setup/Settings in the More dropdown), and the forecast KPIs double as the Graph/Table card header (no separate title row) — so the chart is visible on load without scrolling. `ProjectionPanel` owns the switcher (`view` + swipe `dir` state) and renders the active view + the sidebar; strategy open/close state + the change handler live in `PlanEditor`, which builds the `sidebar` and `calendar` nodes it passes in. `ProjectionChart`/`ComparePlansChart` accept a `heightClass` so the chart reads taller on desktop without breaking mobile. Both plans routes render at `max-w-7xl`: the shared client `PortalPageContainer` widens for any `/portal/plans` path, vs the default `max-w-5xl` reading-width content pages.
- **Module mascot**: `app/portal/plans/layout.tsx` appends the decorative miner mascot ([`ContextAvatar`](../../components/portal/context-avatar.tsx), `variant="finance"`) after the content of every plans page, gated by the `showContextAvatar` user preference — see [settings.md](./settings.md).
- **Chart hover → sidebar preview.** Hovering a point on the Overview projection chart previews THAT period in the sidebar figures card: the health donut + the four `StatRow` figures animate (count up/down, `useAnimatedNumber`, same easeOutQuint as the donut) to the hovered period's values, the card takes a muted backdrop + ring, and a floating chip names the period (e.g. "May 2026"); on mouse-leave (or hovering today's boundary point) everything reverts to the current period. Plumbing: `ProjectionChart` exposes `onHoverIndex` (recharts `onMouseMove.activeTooltipIndex`, deduped via ref) → `ProjectionPanel` maps the index to per-point `PeriodFigures` (flows from the projection month sharing the point's period — calibrated first, raw `pastProjection` fallback; debt prefers the point's own snapshot value) → `PlanEditor` holds the `hoverFigures` state its sidebar reads. Health/surplus are derived on the fly (pure functions of income/obligations), so nothing extra is stored in snapshots. Row breakdowns (tap/click) intentionally stay on the CURRENT period — historical line-items aren't recorded. The chart tooltip itself also shows Debt / Investments rows (only when > 0), carried on `ChartPoint` as tooltip-only extras, never plotted as lines.


## Calculation semantics (audit 2026-09-29)

Regression tests live next to the code (`lib/finance/*.test.ts`, `lib/services/finance-*.test.ts`, `schemas/finance.test.ts`, `lib/utils/{date,format}.test.ts`, `components/finance/{period-compare-dialog,plan-calendar}.test.tsx`, `app/actions/finance-plans.test.ts`); the numbers in them are the audit's worked examples.

- **As-of day.** Opening balances are read on a day: a user confirmation's day, the plan's `balances_as_of`, or — on rows from before that column — the creation day (a scenario inherits its base plan's). Inside the period that contains it, occurrences dated on/before it are already in the balances — they still count in the period's income / expense / debt-payment totals (the period's budget) but are not applied again (`ProjectionMonth.preAsOfCashFlow`), and every rate in that period (debt interest, savings and investment interest, portfolio growth) accrues only for the days that remain. An as-of day outside the first period is ignored (calibration rebases a later one so it lands in period 0). Confirming late in a period no longer double-counts that period's paycheque and bills; the confirmation dialog pre-fills the projected position ON today, so saving it unchanged moves nothing.
- **Occurrences.** Every surface resolves line dates through `planOccurrences`: day-31 lines clamp to month-end; weekday rules fall back to the last weekday; a period that holds two hit dates counts both (income AND debt payments — debts used to pay only the first); a rescheduled occurrence moves in the projection too, even into another period.
- **Debts.** Interest accrues day-weighted between payment dates (one monthly rate per period). The final payment is capped at the balance; percent-of-balance minimums are recomputed on the balance. The calendar's debt chips show the payment the projection made (nothing once paid off).
- **Surplus routing.** Avalanche / snowball roll over the FULL minimum of every debt already paid off, then add `surplusToDebtsPercent` of what is left, as extra principal in strategy order; "none" rolls nothing. Extra payments and auto-invest never exceed the cash on hand — nothing is borrowed to prepay or invest while savings are overdrawn. Savings and investments earn their rate on the period's OPENING balance.
- **Strategy picker.** Every row runs with the plan's own surplus share (no forced 60%); at 0% the picker says the strategies only decide where freed minimums roll over. The comparison uses the same options as the chart (portfolio growth included).
- **Debt-free.** One definition everywhere: months from today until the payoff period (`debtFreeMonthsFromNow`), shown with its month ("Debt-free in 4 mo · Dec 2026"). Debts that all start at $0 read "No debt".
- **Scenario vs base.** Clones copy overrides (re-pointed), not confirmations. The ghost line and the delta card compare both plans as written, from the base plan's as-of day, at the SAME period (the earlier end date), with payoff compared as dates.
- **Compare chart.** Rows are calendar months; each plan contributes its own point for that month (plans were joined by array index). The rail's NW shows the date it describes.
- **Table.** "Debt pmt" includes extra payments and a Savings column reconciles each row; condensed rows are real Decembers.
- **Rates.** Monthly rates are decimals and are refused above 1 (100% a month) with a message that explains the unit; shares (surplus, auto-invest, minimum payment %) are refused above 1.
- **Money formatting.** `formatCurrency` rounds to cents first (no "−$0.00"); `moneySign` classes anything within half a cent of 0 as zero, not a deficit; `formatCurrencyCompact` picks the unit after rounding (999,960 → "$1M").
- **Opening balances are dated (`balances_as_of`).** A plan's initial savings, initial investments and debt opening balances are ONE set stated as of `finance_plans.balances_as_of` (set on create to the reader's today). Editing any of them — or adding a debt with a non-zero balance — restates the whole set as of today: the edited figure takes the new value and every other one rolls forward to where the calibrated plan stands today (`projectStateAt`), so payments made in between are neither lost nor replayed. A no-op edit (same values at cent precision) re-dates nothing. Re-dating only the edited figure would treat stale figures as current. Precedence in `calibratePlan`: the latest confirmation wins when it is dated on or after `balances_as_of` (a restatement on the day of a confirmation also updates that confirmation, so a tie is never ambiguous); otherwise the plan's own set is the baseline, as of that day — a day after period 0 rebases the start to its period (end date kept). Null (old rows) falls back to the creation day.
- **Nothing before the start date.** With an anchor day > 1, period 0 begins before the plan's start date (a January plan on day 15 opens Dec 15). The engine never applies flows dated before the start date (the 1st of the start month): inside period 0 the as-of floor is max(as-of, start − 1 day), even when the as-of lies outside period 0 (a plan created before its start). `projectStateAt` reports `before-start` until the start date.
- **Calendar: "Just this month" moves cross months.** A recurring occurrence can be moved to any day of its own month or of the `RESCHEDULE_MARGIN_MONTHS` (2) months either side — in the calendar, any visible cell; further than that the resolver would not find it, so the prompt disables the option and the schema refuses it. Overrides stay keyed by the CADENCE month (the month the cadence put the occurrence in): moving March's rent to Apr 2 writes March's override, April's own rent keeps its own key, and the projection counts no rent in March and two in April. Each chip carries its `cadenceMonth`, so skipping, clearing or re-moving a moved chip acts on its own month's override, not the month it is shown in.
