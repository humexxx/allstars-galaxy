import * as React from "react"

export type ChartConfig = {
    [k in string]: {
      label?: React.ReactNode
      icon?: React.ComponentType
    } & (
      | { color?: string; theme?: never }
      | { color?: never; theme: Record<string, string> }
    )
  }

/** One point of a value-over-time series; `date` is an ISO timestamp. */
export type ChartDataPoint = {
  date: string
  value: number
}

export type TimeRange = "30d" | "90d" | "120d" | "1yr" | "All"
