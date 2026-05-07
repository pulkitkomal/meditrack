export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  gender?: string;
  age?: number;
  date_of_birth?: string;
  blood_type?: string;
  height?: number;
  weight?: number;
  emergency_contact?: string;
  medical_conditions?: string[];
  allergies?: string[];
  glucose_unit?: string;
  timezone?: string;
  telegram_enabled?: boolean;
  telegram_chat_id?: string;
  notification_times?: string[];
  tracking_types?: string[];
}

export interface Document {
  id: string;
  original_name: string;
  category: string;
  file_size: number;
  upload_date: string;
  document_date?: string;
  description?: string;
}

export interface HealthReading {
  id: string;
  type: "glucose" | "bp";
  value: number | string;
  unit: string;
  systolic?: number;
  diastolic?: number;
  timestamp: string;
  source: string;
}

export interface TelegramConfig {
  enabled: boolean;
  connected: boolean;
  notification_times: string[];
  tracking_types: string[];
}