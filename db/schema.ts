import { pgTable, text, uuid, timestamp, pgSchema, real, pgEnum, numeric, index, boolean } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", ["admin", "user"]);
export const riskLevelEnum = pgEnum("risk_level", ["Low", "Medium", "High"]);
export const transactionStatusEnum = pgEnum("transaction_status", ["pending", "approved", "rejected", "closed"]);
export const transactionTypeEnum = pgEnum("transaction_type", ["buy", "withdrawal"]);
export const snapshotSourceEnum = pgEnum("snapshot_source", ["system_cron", "admin_approval", "manual", "admin_enforce"]);
export const roadPathFrequencyEnum = pgEnum("road_path_frequency", ["daily", "every_other_day", "weekly", "biweekly", "monthly"]);
export const taskPriorityEnum = pgEnum("task_priority", ["low", "medium", "high"]);

// Define auth schema to reference auth.users
const authSchema = pgSchema("auth");
const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

export const users = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }), // Foreign Key with Cascade Delete
  email: text("email"),
  fullName: text("full_name"),
  avatarUrl: text("avatar_url"),
  role: userRoleEnum("role").default("user"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const investmentMethods = pgTable("investment_methods", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  author: text("author").notNull(),
  riskLevel: riskLevelEnum("risk_level").notNull(),
  monthlyRoi: numeric("monthly_roi", { precision: 7, scale: 4 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const portfolios = pgTable("portfolios", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  name: text("name").notNull().default("My Main Portfolio"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    investmentMethodId: uuid("investment_method_id")
      .notNull()
      .references(() => investmentMethods.id, { onDelete: "restrict" }),
    type: transactionTypeEnum("type").notNull(),
    amount: numeric("amount", { precision: 20, scale: 2 }).notNull(),
    fee: numeric("fee", { precision: 20, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 20, scale: 2 }).notNull(),
    initialValue: numeric("initial_value", { precision: 20, scale: 2 }),
    currentValue: numeric("current_value", { precision: 20, scale: 2 }),
    sourceTransactionId: uuid("source_transaction_id"),
    withdrawalTransactionIds: text("withdrawal_transaction_ids").array(),
    date: timestamp("date", { withTimezone: true }).notNull(),
    notes: text("notes"),
    status: transactionStatusEnum("status").notNull().default("pending"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    rejectedBy: uuid("rejected_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("transactions_portfolio_id_idx").on(t.portfolioId),
    index("transactions_investment_method_id_idx").on(t.investmentMethodId),
    index("transactions_status_idx").on(t.status),
    index("transactions_date_idx").on(t.date),
    index("transactions_approved_by_idx").on(t.approvedBy),
    index("transactions_rejected_by_idx").on(t.rejectedBy),
  ]
);

export const portfolioSnapshots = pgTable(
  "portfolio_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    date: timestamp("date", { withTimezone: true }).notNull(),
    totalValue: numeric("total_value", { precision: 20, scale: 2 }).notNull(),
    source: snapshotSourceEnum("source").notNull().default("system_cron"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("portfolio_snapshots_portfolio_id_idx").on(t.portfolioId),
    index("portfolio_snapshots_date_idx").on(t.date),
  ]
);

export const appState = pgTable("app_state", {
  key: text("key").primaryKey(),
  value: text("value"),
  error: text("error"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Finance planning: each user can have multiple plans (scenarios) to model
// future cash flow, debt amortization and net worth.

export const financePlans = pgTable(
  "finance_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    // Anchor month for the projection (first day of the start month).
    startMonth: timestamp("start_month", { withTimezone: true }).notNull(),
    monthsAhead: real("months_ahead").notNull().default(24),
    // Opening balance for the savings line at start_month.
    initialSavings: numeric("initial_savings", { precision: 20, scale: 2 })
      .notNull()
      .default("0"),
    // Monthly interest rate applied to savings (e.g. 0.007 for 0.70% per month).
    monthlySavingsRate: numeric("monthly_savings_rate", { precision: 9, scale: 6 })
      .notNull()
      .default("0"),
    // When true, the projection sums in the user's current portfolio value.
    includePortfolio: boolean("include_portfolio").notNull().default(false),
    // Color for chart visualisation (CSS color or theme token).
    color: text("color").notNull().default("var(--chart-1)"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("finance_plans_user_id_idx").on(t.userId)]
);

export const financePlanIncomes = pgTable(
  "finance_plan_incomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => financePlans.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    monthlyAmount: numeric("monthly_amount", { precision: 20, scale: 2 })
      .notNull()
      .default("0"),
    sortOrder: real("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("finance_plan_incomes_plan_id_idx").on(t.planId)]
);

export const financePlanExpenses = pgTable(
  "finance_plan_expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => financePlans.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    monthlyAmount: numeric("monthly_amount", { precision: 20, scale: 2 })
      .notNull()
      .default("0"),
    sortOrder: real("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("finance_plan_expenses_plan_id_idx").on(t.planId)]
);

export const financePlanDebts = pgTable(
  "finance_plan_debts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => financePlans.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    initialBalance: numeric("initial_balance", { precision: 20, scale: 2 })
      .notNull()
      .default("0"),
    // Monthly interest rate as a decimal (e.g. 0.02 for 2% per month).
    monthlyInterestRate: numeric("monthly_interest_rate", { precision: 9, scale: 6 })
      .notNull()
      .default("0"),
    monthlyPayment: numeric("monthly_payment", { precision: 20, scale: 2 })
      .notNull()
      .default("0"),
    sortOrder: real("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("finance_plan_debts_plan_id_idx").on(t.planId)]
);

// Audit trail for mutations performed by an admin while impersonating another user.
export const impersonationLogs = pgTable(
  "impersonation_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminId: uuid("admin_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    impersonatedUserId: uuid("impersonated_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    entityTable: text("entity_table"),
    entityId: uuid("entity_id"),
    metadata: text("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("impersonation_logs_admin_id_idx").on(t.adminId),
    index("impersonation_logs_impersonated_user_id_idx").on(t.impersonatedUserId),
    index("impersonation_logs_created_at_idx").on(t.createdAt),
  ]
);

// Productivity Feature Tables
export const boardColumns = pgTable(
  "board_columns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    order: real("order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("board_columns_user_id_idx").on(t.userId)]
);

export const boardTasks = pgTable(
  "board_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    columnId: uuid("column_id")
      .notNull()
      .references(() => boardColumns.id, { onDelete: "cascade" }),
    roadPathId: uuid("road_path_id").references(() => roadPaths.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    priority: taskPriorityEnum("priority"),
    order: real("order").notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("board_tasks_user_id_idx").on(t.userId),
    index("board_tasks_column_id_idx").on(t.columnId),
    index("board_tasks_road_path_id_idx").on(t.roadPathId),
  ]
);

export const roadPaths = pgTable(
  "road_paths",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    targetValue: numeric("target_value", { precision: 20, scale: 2 }),
    currentValue: numeric("current_value", { precision: 20, scale: 2 }).default("0"),
    unit: text("unit"),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    targetDate: timestamp("target_date", { withTimezone: true }),
    autoCreateTasks: boolean("auto_create_tasks").notNull().default(false),
    taskFrequency: roadPathFrequencyEnum("task_frequency"),
    lastTaskCreatedAt: timestamp("last_task_created_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("road_paths_user_id_idx").on(t.userId)]
);

export const roadPathMilestones = pgTable(
  "road_path_milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roadPathId: uuid("road_path_id")
      .notNull()
      .references(() => roadPaths.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    targetValue: numeric("target_value", { precision: 20, scale: 2 }),
    order: real("order").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("road_path_milestones_road_path_id_idx").on(t.roadPathId)]
);

export const roadPathProgress = pgTable(
  "road_path_progress",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roadPathId: uuid("road_path_id")
      .notNull()
      .references(() => roadPaths.id, { onDelete: "cascade" }),
    value: numeric("value", { precision: 20, scale: 2 }).notNull(),
    notes: text("notes"),
    date: timestamp("date", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("road_path_progress_road_path_id_idx").on(t.roadPathId),
    index("road_path_progress_date_idx").on(t.date),
  ]
);

// Relations
export const transactionsRelations = relations(transactions, ({ one }) => ({
  investmentMethod: one(investmentMethods, {
    fields: [transactions.investmentMethodId],
    references: [investmentMethods.id],
  }),
  portfolio: one(portfolios, {
    fields: [transactions.portfolioId],
    references: [portfolios.id],
  }),
}));

export const boardColumnsRelations = relations(boardColumns, ({ one, many }) => ({
  user: one(users, {
    fields: [boardColumns.userId],
    references: [users.id],
  }),
  tasks: many(boardTasks),
}));

export const boardTasksRelations = relations(boardTasks, ({ one }) => ({
  user: one(users, {
    fields: [boardTasks.userId],
    references: [users.id],
  }),
  column: one(boardColumns, {
    fields: [boardTasks.columnId],
    references: [boardColumns.id],
  }),
  roadPath: one(roadPaths, {
    fields: [boardTasks.roadPathId],
    references: [roadPaths.id],
  }),
}));

export const roadPathsRelations = relations(roadPaths, ({ one, many }) => ({
  user: one(users, {
    fields: [roadPaths.userId],
    references: [users.id],
  }),
  milestones: many(roadPathMilestones),
  progress: many(roadPathProgress),
  tasks: many(boardTasks),
}));

export const roadPathMilestonesRelations = relations(roadPathMilestones, ({ one }) => ({
  roadPath: one(roadPaths, {
    fields: [roadPathMilestones.roadPathId],
    references: [roadPaths.id],
  }),
}));

export const roadPathProgressRelations = relations(roadPathProgress, ({ one }) => ({
  roadPath: one(roadPaths, {
    fields: [roadPathProgress.roadPathId],
    references: [roadPaths.id],
  }),
}));
