// 5 bi-monthly food (Ushqimi) periods, matching the office's Excel layout.
// Payments are stored under the period's first calendar month (canonicalMonth);
// `months` covers both calendar months so historical data entered under either
// month of a period still buckets correctly.
export interface FoodPeriod {
  label: string;
  months: number[];
  canonicalMonth: number;
}

export const PERIOD_BUCKETS: FoodPeriod[] = [
  { label: "Shtator/Tetor",  months: [9, 10],  canonicalMonth: 9  },
  { label: "Nëntor/Dhjetor", months: [11, 12], canonicalMonth: 11 },
  { label: "Janar/Shkurt",   months: [1, 2],   canonicalMonth: 1  },
  { label: "Mars/Prill",     months: [3, 4],   canonicalMonth: 3  },
  { label: "Maj/Qershor",    months: [5, 6],   canonicalMonth: 5  },
];
