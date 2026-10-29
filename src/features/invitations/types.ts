import type { AttendanceResponse } from '../../shared/domain/attendance';
export interface PublicCard {
  title: string;
  message: string;
  contact: string;
  date: string;
  time: string;
  timeZone: string;
  address: string;
  deadline: string;
  deadlineAtUTC: string;
  status: string;
}
export interface GuestView {
  state: 'open' | 'cancelled';
  title: string;
  card: PublicCard | null;
  group: { label: string; response: AttendanceResponse; responseVersion: number } | null;
  canRespond: boolean;
  eventVersion: number;
  cardVersion: number;
  expiresAtMs: number;
}
export interface CardSettings {
  version: number;
  published: boolean;
  title: string;
  message: string;
  contact: string;
  publicToken: string;
  publicRevoked: boolean;
}
export interface GuestGroup {
  id: string;
  label: string;
  version: number;
  revoked: boolean;
  token: string;
  response: AttendanceResponse;
  responseVersion: number;
  lastReason: string;
}
export interface InvitationDashboard {
  card: CardSettings | null;
  groups: GuestGroup[];
  totals: {
    invited: number;
    responded: number;
    pending: number;
    attending: number;
    declined: number;
    adults: number;
    children: number;
    people: number;
  };
  eventVersion: number;
  expiresAtMs: number;
}
