import { useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { useStore } from '@/lib/store';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const { notifications, refreshNotifications, markNotificationRead, markAllNotificationsRead } = useStore();
  const [open, setOpen] = useState(false);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  useEffect(() => {
    if (open && unreadCount > 0) {
      markAllNotificationsRead();
    }
  }, [open, unreadCount, markAllNotificationsRead]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Notifications</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {notifications.length === 0 && (
              <p className="text-sm text-muted-foreground">No notifications yet.</p>
            )}
            {notifications.map((n) => (
              <div
                key={n.id}
                className={cn(
                  'rounded-md border p-3 text-sm',
                  n.is_read ? 'border-zinc-200 bg-white' : 'border-primary/40 bg-primary/10'
                )}
              >
                <p className="font-semibold">{n.title}</p>
                <p className="text-muted-foreground">{n.message}</p>
                {!n.is_read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 h-7 px-2"
                    onClick={() => markNotificationRead(n.id)}
                  >
                    Mark as read
                  </Button>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
