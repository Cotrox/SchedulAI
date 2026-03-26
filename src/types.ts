export interface User {
  id: string;
  email: string;
  emailNotifications?: boolean;
  onboarded?: boolean;
}

export interface Deadline {
  id: string;
  userId: string;
  title: string;
  amount: number;
  dueDate: string;
  frequency: "monthly" | "annual" | "one-time";
  lastPaidDate: string;
  category: string;
}

export interface ChatMessage {
  role: "user" | "model";
  text: string;
}
