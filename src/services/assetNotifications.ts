import { supabase } from '@/services/supabase';
import { notificationApi } from '@/services/notificationApi';

export async function resolveAssetNotificationRecipients(targetUserId: string): Promise<string[]> {
  try {
    const roleNames = ['hr', 'admin', 'super_admin'];
    const { data: rolesData, error: rolesError } = await supabase
      .from('roles')
      .select('id, name')
      .in('name', roleNames);
    if (rolesError) throw rolesError;
    const roleIds = (rolesData || []).map((r: any) => r.id);

    const { data: roleUsers, error: usersError } = await supabase
      .from('users')
      .select('id, role_id')
      .in('role_id', roleIds);
    if (usersError) throw usersError;

    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .select('manager_id')
      .eq('id', targetUserId)
      .single();
    if (userErr) throw userErr;

    const recipients = new Set<string>();
    (roleUsers || []).forEach((u: any) => recipients.add(u.id));
    if (userRow?.manager_id) recipients.add(userRow.manager_id);
    recipients.delete(targetUserId);
    return Array.from(recipients);
  } catch (e) {
    console.error('Failed to resolve notification recipients:', e);
    return [];
  }
}

export async function sendAssetRetrievalNotification(params: { targetUserId: string; targetUserName: string; activeAssetCount: number; }) {
  try {
    const recipientIds = await resolveAssetNotificationRecipients(params.targetUserId);
    if (!recipientIds || recipientIds.length === 0) return;

    const title = 'Retrieve Assets for Inactive Employee';
    const message = `${params.targetUserName} is inactive and has ${params.activeAssetCount} active asset${params.activeAssetCount !== 1 ? 's' : ''} assigned. Please retrieve them.`;
    const payload = { type: 'asset_retrieval_required', data: { user_id: params.targetUserId, reason: 'user_inactive' } } as const;

    await Promise.all(
      recipientIds.map((rid) => notificationApi.createNotification({
        user_id: rid,
        title,
        message,
        type: payload.type,
        data: payload.data
      }))
    );
  } catch (e) {
    console.error('Failed to send asset retrieval notifications:', e);
  }
}


