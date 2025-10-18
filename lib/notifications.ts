export type Notice = {
  id: string;
  title: string;
  body: string;
  read?: boolean;
};

const MOCK_NOTICES: Notice[] = [
  { id: 'n1', title: 'Shift Reminder', body: 'Your shift starts in 30 minutes.', read: false },
  { id: 'n2', title: 'Shift Update', body: 'Tomorrow’s shift moved to 10:00 AM.', read: false },
  { id: 'n3', title: 'Policy Update', body: 'Please review the new break policy.', read: true },
];

export function getNotifications(): Notice[] {
  return MOCK_NOTICES;
}

export function getUnreadCount(): number {
  return MOCK_NOTICES.filter((n) => !n.read).length;
}
