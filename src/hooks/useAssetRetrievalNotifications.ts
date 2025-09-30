import { useEffect } from 'react';
import { sendAssetRetrievalNotification } from '@/services/assetNotifications';

type UserWithHistory = {
  userId: string;
  user: { id: string; full_name: string; status: string };
  activeCount: number;
};

export function useAssetRetrievalNotifications(enhancedUsersWithHistory: UserWithHistory[] | any[]) {
  useEffect(() => {
    const riskUsers = (enhancedUsersWithHistory || []).filter((u: any) => (u.user?.status && u.user.status !== 'active') && (u.activeCount && u.activeCount > 0));

    const now = Date.now();
    riskUsers.forEach((u: any) => {
      const key = `asset-retrieval-lastSent-${u.user.id}`;
      const lastSent = parseInt(localStorage.getItem(key) || '0', 10);
      if (!lastSent || now - lastSent >= 24 * 60 * 60 * 1000) {
        sendAssetRetrievalNotification({ targetUserId: u.user.id, targetUserName: u.user.full_name, activeAssetCount: u.activeCount });
        localStorage.setItem(key, String(now));
      }
    });

    const intervalId = window.setInterval(() => {
      const checkNow = Date.now();
      (enhancedUsersWithHistory || [])
        .filter((u: any) => (u.user?.status && u.user.status !== 'active') && (u.activeCount && u.activeCount > 0))
        .forEach((u: any) => {
          const key = `asset-retrieval-lastSent-${u.user.id}`;
          const lastSent = parseInt(localStorage.getItem(key) || '0', 10);
          if (!lastSent || checkNow - lastSent >= 24 * 60 * 60 * 1000) {
            sendAssetRetrievalNotification({ targetUserId: u.user.id, targetUserName: u.user.full_name, activeAssetCount: u.activeCount });
            localStorage.setItem(key, String(checkNow));
          }
        });
    }, 24 * 60 * 60 * 1000);

    (enhancedUsersWithHistory || [])
      .filter((u: any) => !(u.user?.status && u.user.status !== 'active' && (u.activeCount && u.activeCount > 0)))
      .forEach((u: any) => {
        const key = `asset-retrieval-lastSent-${u.user.id}`;
        localStorage.removeItem(key);
      });

    return () => {
      window.clearInterval(intervalId);
    };
  }, [JSON.stringify(enhancedUsersWithHistory)]);
}


