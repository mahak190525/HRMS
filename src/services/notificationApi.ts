import { supabase } from './supabase';
import type { User } from '@/types';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  data: Record<string, any>;
  is_read: boolean;
  created_at: string;
  read_at?: string;
}

export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh_key: string;
  auth_key: string;
  user_agent?: string;
  created_at: string;
}

export const notificationApi = {
  // Get user notifications
  async getUserNotifications(userId: string, limit: number = 50) {
    console.log('Fetching notifications for user:', userId);
    
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
    
    console.log(`Found ${data?.length || 0} notifications for user ${userId}:`, data);
    return data;
  },

  // Get unread notifications count
  async getUnreadCount(userId: string) {
    console.log('Fetching unread count for user:', userId);
    
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    
    if (error) {
      console.error('Error fetching unread count:', error);
      throw error;
    }
    
    console.log(`Unread count for user ${userId}:`, count || 0);
    return count || 0;
  },

  // Mark notification as read
  async markAsRead(notificationId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('id', notificationId)
      .select()
      .single();
    
    if (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
    return data;
  },

  // Mark all notifications as read
  async markAllAsRead(userId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .update({
        is_read: true,
        read_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('is_read', false);
    
    if (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
    return data;
  },

  // Delete notification
  async deleteNotification(notificationId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .select()
      .single();
    
    if (error) {
      console.error('Error deleting notification:', error);
      throw error;
    }
    return data;
  },

  // Delete all read notifications
  async deleteAllReadNotifications(userId: string) {
    const { data, error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)
      .eq('is_read', true);
    
    if (error) {
      console.error('Error deleting read notifications:', error);
      throw error;
    }
    return data;
  },

  // Create notification (for testing or manual creation)
  async createNotification(notification: {
    user_id: string;
    title: string;
    message: string;
    type?: string;
    data?: Record<string, any>;
  }) {
    console.log('Creating notification with data:', {
      user_id: notification.user_id,
      title: notification.title,
      message: notification.message,
      type: notification.type || 'general',
      data: notification.data || {}
    });
    
    const attempt = async (forcedType?: string) => {
      const { data, error } = await supabase.rpc('create_notification', {
        p_user_id: notification.user_id,
        p_title: notification.title,
        p_message: notification.message,
        p_type: forcedType || notification.type || 'general',
        p_data: notification.data || {}
      });
      if (error) throw error;
      return data;
    };

    try {
      const data = await attempt();
      console.log('Notification created successfully via RPC:', data);
      return data;
    } catch (error: any) {
      // If type violates constraint (code 23514), retry with 'general'
      if (error?.code === '23514') {
        try {
          console.warn('Notification type not allowed by constraint; retrying with general. Original type:', notification.type);
          const data = await attempt('general');
          return data;
        } catch (retryError) {
          console.error('Retry with general type failed:', retryError);
          throw retryError;
        }
      }
      console.error('Exception in createNotification:', error);
      throw error;
    }
  },

  // Push subscription management
  async savePushSubscription(userId: string, subscription: PushSubscriptionJSON) {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint: subscription.endpoint!,
        p256dh_key: subscription.keys!.p256dh,
        auth_key: subscription.keys!.auth,
        user_agent: navigator.userAgent,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,endpoint'
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async removePushSubscription(userId: string, endpoint: string) {
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint);
    
    if (error) throw error;
  },

  async getUserPushSubscriptions(userId: string) {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);
    
    if (error) throw error;
    return data;
  },

  // Asset Request Notification Helpers
  async createAssetRequestNotification(assetRequestData: {
    asset_request_id: string;
    employee_id: string;
    employee_name: string;
    category_name: string;
    description: string;
    priority?: string;
    recipients: Array<{
      user_id: string;
      role: string;
      can_approve: boolean;
    }>;
  }) {
    const notifications = assetRequestData.recipients.map(recipient => ({
      user_id: recipient.user_id,
      title: recipient.can_approve 
        ? 'Asset Request Requires Approval'
        : 'New Asset Request Submitted',
      message: recipient.can_approve
        ? `${assetRequestData.employee_name} has submitted an asset request for ${assetRequestData.category_name} that requires your approval: ${assetRequestData.description}`
        : `${assetRequestData.employee_name} has submitted a request for ${assetRequestData.category_name}: ${assetRequestData.description}`,
      type: 'asset_request_submitted',
      data: {
        asset_request_id: assetRequestData.asset_request_id,
        employee_id: assetRequestData.employee_id,
        employee_name: assetRequestData.employee_name,
        category_name: assetRequestData.category_name,
        description: assetRequestData.description,
        priority: assetRequestData.priority,
        action: recipient.can_approve ? 'approve_or_reject' : 'monitor',
        target: 'employees/asset-management',
        can_approve: recipient.can_approve
      }
    }));

    // Create all notifications
    const results = await Promise.allSettled(
      notifications.map(notification => this.createNotification(notification))
    );

    // Log any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Failed to create notification for recipient ${notifications[index].user_id}:`, result.reason);
      }
    });

    return results;
  },

  async createAssetStatusNotification(statusData: {
    asset_request_id: string;
    user_id: string;
    category_name: string;
    description: string;
    status: 'approved' | 'rejected' | 'fulfilled';
    approver_name?: string;
    rejector_name?: string;
    rejection_reason?: string;
    fulfilled_by?: string;
    fulfilled_asset_id?: string;
  }) {
    let title: string;
    let message: string;
    let type: string;

    switch (statusData.status) {
      case 'approved':
        title = 'Asset Request Approved';
        message = `Your asset request for ${statusData.category_name} has been approved by ${statusData.approver_name || 'a manager'}.`;
        type = 'asset_request_approved';
        break;
      case 'rejected':
        title = 'Asset Request Rejected';
        message = `Your asset request for ${statusData.category_name} has been rejected by ${statusData.rejector_name || 'a manager'}${
          statusData.rejection_reason ? `. Reason: ${statusData.rejection_reason}` : '.'
        }`;
        type = 'asset_request_rejected';
        break;
      case 'fulfilled':
        title = 'Asset Request Fulfilled';
        message = `Your asset request for ${statusData.category_name} has been fulfilled. The asset has been assigned to you.`;
        type = 'asset_request_fulfilled';
        break;
      default:
        throw new Error(`Invalid status: ${statusData.status}`);
    }

    return this.createNotification({
      user_id: statusData.user_id,
      title,
      message,
      type,
      data: {
        asset_request_id: statusData.asset_request_id,
        category_name: statusData.category_name,
        description: statusData.description,
        status: statusData.status,
        approver_name: statusData.approver_name,
        rejector_name: statusData.rejector_name,
        rejection_reason: statusData.rejection_reason,
        fulfilled_by: statusData.fulfilled_by,
        fulfilled_asset_id: statusData.fulfilled_asset_id,
        target: 'dashboard/assets'
      }
    });
  },

  // Asset Assignment Notification Helpers
  async createAssetAssignmentNotification(assignmentData: {
    assignment_id: string;
    user_id: string;
    asset_name: string;
    asset_tag?: string;
    asset_category?: string;
    assigned_by_name: string;
    assignment_type?: string;
    assignment_expiry_date?: string;
    is_vm?: boolean;
    vm_details?: string;
  }) {
    const isVM = assignmentData.is_vm || false;
    const title = isVM ? 'Virtual Machine Assigned' : 'Asset Assigned';
    const assetDescription = isVM ? assignmentData.asset_name : 
      `${assignmentData.asset_name}${assignmentData.asset_tag ? ` (${assignmentData.asset_tag})` : ''}`;
    
    let message = `You have been assigned ${assetDescription} by ${assignmentData.assigned_by_name}`;
    
    if (assignmentData.vm_details && isVM) {
      message += `. VM Purpose: ${assignmentData.vm_details}`;
    }
    
    if (assignmentData.assignment_type === 'temporary' && assignmentData.assignment_expiry_date) {
      message += `. This is a temporary assignment until ${new Date(assignmentData.assignment_expiry_date).toLocaleDateString()}.`;
    } else {
      message += '. This is a permanent assignment.';
    }

    return this.createNotification({
      user_id: assignmentData.user_id,
      title,
      message,
      type: isVM ? 'vm_assigned' : 'asset_assigned',
      data: {
        assignment_id: assignmentData.assignment_id,
        asset_name: assignmentData.asset_name,
        asset_tag: assignmentData.asset_tag,
        asset_category: assignmentData.asset_category,
        assigned_by_name: assignmentData.assigned_by_name,
        assignment_type: assignmentData.assignment_type,
        assignment_expiry_date: assignmentData.assignment_expiry_date,
        is_vm: isVM,
        vm_details: assignmentData.vm_details,
        target: 'dashboard/assets'
      }
    });
  },

  async createAssetUnassignmentNotification(unassignmentData: {
    user_id: string;
    asset_name: string;
    asset_tag?: string;
    asset_category?: string;
    return_condition?: string;
    assignment_duration_days?: number;
    is_vm?: boolean;
  }) {
    const isVM = unassignmentData.is_vm || false;
    const title = isVM ? 'Virtual Machine Returned' : 'Asset Returned';
    const assetDescription = isVM ? unassignmentData.asset_name : 
      `${unassignmentData.asset_name}${unassignmentData.asset_tag ? ` (${unassignmentData.asset_tag})` : ''}`;
    
    let message = `Your assignment for ${assetDescription} has been completed and the ${isVM ? 'VM' : 'asset'} has been returned`;
    
    if (unassignmentData.return_condition) {
      message += ` in ${unassignmentData.return_condition} condition`;
    }
    
    message += '.';

    return this.createNotification({
      user_id: unassignmentData.user_id,
      title,
      message,
      type: isVM ? 'vm_unassigned' : 'asset_unassigned',
      data: {
        asset_name: unassignmentData.asset_name,
        asset_tag: unassignmentData.asset_tag,
        asset_category: unassignmentData.asset_category,
        return_condition: unassignmentData.return_condition,
        assignment_duration_days: unassignmentData.assignment_duration_days,
        is_vm: isVM,
        target: 'dashboard/assets'
      }
    });
  }
}