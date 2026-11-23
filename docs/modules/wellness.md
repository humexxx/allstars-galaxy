# Wellness

> **Status:** Active
> **Last reviewed:** 2026-11-22

## Overview
Health tools for the account holder. Today it is one page: a calorie
calculator that turns sex, age, height, weight, activity and a goal into a
daily calorie target and a protein / fat / carbs split, and shows how it got
there. Nothing is stored on the server.

## Routes
- `/portal/wellness/calories` — calorie calculator (gated by `requireModulePage("wellness")`)

## Server actions — `/app/actions/`
—

## Services — `/lib/services/`
—

## Schemas — `/schemas/`
- `wellness.ts` — `calorieFormSchema`: the form as typed (strings, metric or imperial) parsed into metric `CalorieInput`

## Types — `/types/`
—

## Components
`components/wellness/` — `calorie-calculator.tsx`, the form and the live result (client component).

## DB tables — `db/schema.ts`
—

## Notes
- Conventional Commits scope: `wellness`
- Maths lives in `lib/wellness/calories.ts` (pure, unit-tested): Mifflin-St Jeor BMR × activity factor (1.2–1.9), ±(pace × 7700 kcal/kg ÷ 7) a day, protein 1.8 g/kg, fat 25% of calories, carbs the rest.
- A deficit never goes under 1500 kcal (men) / 1200 (women); the page says so when it raises the target. Maintain / gain are never raised.
- The last inputs live in `localStorage` (`wellness:calories:v1`), read after mount so the server render matches; no DB, so the module is safe on the production-shared database.
- Module key `wellness` in `lib/access/modules.ts` (label "Calories", area "Wellness"): an admin can turn it off per account.
