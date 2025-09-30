import { supabase } from './supabase';
import { notificationApi } from './notificationApi';
import { AssetImageUploadService } from './assetImageUpload';

export class AssetImageNotificationService {
  /**
   * Send quarterly upload reminder notifications to users with hardware assets
   */
  static async sendQuarterlyUploadReminders(): Promise<{ 
    success: boolean; 
    notificationsSent: number; 
    errors?: string[]; 
    error?: string 
  }> {
    try {
      const { quarter, year } = AssetImageUploadService.getCurrentQuarterAndYear();
      
      // Get all users with active hardware asset assignments
      const { data: usersWithAssets, error: usersError } = await supabase
        .from('asset_assignments')
        .select(`
          user_id,
          asset_id,
          id as assignment_id,
          user:users(full_name, email),
          asset:assets(
            name, 
            asset_tag,
            category:asset_categories(name)
          )
        `)
        .eq('is_active', true)
        .in('asset:assets.status', ['assigned']);

      if (usersError) {
        return { success: false, error: `Failed to fetch asset assignments: ${usersError.message}` };
      }

      if (!usersWithAssets || usersWithAssets.length === 0) {
        return { success: true, notificationsSent: 0 };
      }

      // Filter hardware assets and group by user
      const userAssetMap = new Map<string, any[]>();
      
      for (const assignment of usersWithAssets) {
        const categoryName = assignment.asset?.category?.name?.toLowerCase() || '';
        
        // Skip software/license assets
        if (categoryName.includes('software') || 
            categoryName.includes('license') || 
            categoryName.includes('subscription')) {
          continue;
        }

        const userId = assignment.user_id;
        if (!userAssetMap.has(userId)) {
          userAssetMap.set(userId, []);
        }
        userAssetMap.get(userId)!.push(assignment);
      }

      let notificationsSent = 0;
      const errors: string[] = [];

      // Send notifications to each user
      for (const [userId, assignments] of userAssetMap) {
        try {
          // Check if user has already uploaded images for all their assets this quarter
          let hasIncompleteUploads = false;
          const assetDetails: any[] = [];

          for (const assignment of assignments) {
            const { data: existingImages, error: imageError } = await supabase
              .from('asset_condition_images')
              .select('id')
              .eq('asset_assignment_id', assignment.assignment_id)
              .eq('upload_quarter', quarter)
              .eq('upload_year', year);

            if (imageError) {
              console.warn(`Error checking images for assignment ${assignment.assignment_id}:`, imageError);
            }

            const imageCount = existingImages?.length || 0;
            if (imageCount === 0) {
              hasIncompleteUploads = true;
              assetDetails.push({
                name: assignment.asset.name,
                tag: assignment.asset.asset_tag,
                assignmentId: assignment.assignment_id
              });
            }
          }

          // Only send notification if user has assets without images
          if (hasIncompleteUploads && assetDetails.length > 0) {
            const userName = assignments[0].user?.full_name || 'Employee';
            const assetCount = assetDetails.length;
            const assetNames = assetDetails.slice(0, 3).map(a => a.name).join(', ');
            const additionalText = assetCount > 3 ? ` and ${assetCount - 3} more` : '';

            const title = `Quarterly Asset Image Upload Required - Q${quarter} ${year}`;
            const message = `Hi ${userName}, please upload condition images for your assigned hardware assets: ${assetNames}${additionalText}. Upload up to 5 images per asset to document their current condition.`;

            await notificationApi.createNotification({
              user_id: userId,
              title,
              message,
              type: 'asset_quarterly_upload_reminder',
              data: {
                quarter,
                year,
                assetCount,
                assets: assetDetails
              }
            });

            notificationsSent++;
          }

        } catch (error: any) {
          console.error(`Error sending notification to user ${userId}:`, error);
          errors.push(`User ${userId}: ${error.message}`);
        }
      }

      const hasErrors = errors.length > 0;
      return { 
        success: true, 
        notificationsSent, 
        ...(hasErrors && { errors })
      };

    } catch (error: any) {
      console.error('Error sending quarterly upload reminders:', error);
      return { 
        success: false, 
        notificationsSent: 0,
        error: `Failed to send reminders: ${error.message}` 
      };
    }
  }

  /**
   * Send notification when user uploads asset images
   */
  static async sendUploadConfirmationNotification(
    userId: string, 
    assetName: string, 
    assetTag: string, 
    imageCount: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { quarter, year } = AssetImageUploadService.getCurrentQuarterAndYear();
      
      const title = 'Asset Images Uploaded Successfully';
      const message = `Thank you for uploading ${imageCount} condition image${imageCount > 1 ? 's' : ''} for ${assetName} (${assetTag}) for Q${quarter} ${year}.`;

      await notificationApi.createNotification({
        user_id: userId,
        title,
        message,
        type: 'asset_images_uploaded',
        data: {
          assetName,
          assetTag,
          imageCount,
          quarter,
          year
        }
      });

      return { success: true };

    } catch (error: any) {
      console.error('Error sending upload confirmation:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send overdue upload notification
   */
  static async sendOverdueUploadNotification(
    userId: string, 
    overdueAssets: Array<{ name: string; tag: string; assignmentId: string }>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { quarter, year } = AssetImageUploadService.getCurrentQuarterAndYear();
      
      const assetCount = overdueAssets.length;
      const assetNames = overdueAssets.slice(0, 2).map(a => a.name).join(', ');
      const additionalText = assetCount > 2 ? ` and ${assetCount - 2} more` : '';

      const title = '⚠️ Overdue: Asset Image Upload Required';
      const message = `URGENT: Please upload condition images for your assigned assets: ${assetNames}${additionalText}. This is required for Q${quarter} ${year} compliance.`;

      await notificationApi.createNotification({
        user_id: userId,
        title,
        message,
        type: 'asset_upload_overdue',
        data: {
          quarter,
          year,
          assetCount,
          assets: overdueAssets,
          isOverdue: true
        }
      });

      return { success: true };

    } catch (error: any) {
      console.error('Error sending overdue notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check and send notifications for users who haven't uploaded images
   * This can be called periodically (e.g., monthly) to remind users
   */
  static async checkAndNotifyPendingUploads(): Promise<{ 
    success: boolean; 
    remindersSent: number; 
    overduesSent: number; 
    error?: string 
  }> {
    try {
      const { quarter, year } = AssetImageUploadService.getCurrentQuarterAndYear();
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-indexed
      
      // Determine if we're in the middle or end of the quarter (for overdue notifications)
      const quarterStartMonth = (quarter - 1) * 3 + 1;
      const isQuarterEnd = currentMonth === quarterStartMonth + 2; // Third month of quarter

      // Get users needing uploads
      const { success, users, error } = await AssetImageUploadService.getUsersNeedingQuarterlyUpload();
      
      if (!success || error) {
        return { success: false, remindersSent: 0, overduesSent: 0, error };
      }

      if (!users || users.length === 0) {
        return { success: true, remindersSent: 0, overduesSent: 0 };
      }

      let remindersSent = 0;
      let overduesSent = 0;

      // Group by user and send appropriate notifications
      const userAssetMap = new Map<string, any[]>();
      
      for (const user of users) {
        if (!userAssetMap.has(user.user_id)) {
          userAssetMap.set(user.user_id, []);
        }
        userAssetMap.get(user.user_id)!.push(user);
      }

      for (const [userId, userAssets] of userAssetMap) {
        const assets = userAssets.map(ua => ({
          name: ua.asset_name,
          tag: ua.asset_tag,
          assignmentId: ua.assignment_id
        }));

        if (isQuarterEnd) {
          // Send overdue notification near end of quarter
          await this.sendOverdueUploadNotification(userId, assets);
          overduesSent++;
        } else {
          // Send regular reminder
          const userName = userAssets[0].user_name || 'Employee';
          const assetCount = assets.length;
          const assetNames = assets.slice(0, 3).map(a => a.name).join(', ');
          const additionalText = assetCount > 3 ? ` and ${assetCount - 3} more` : '';

          const title = `Reminder: Quarterly Asset Image Upload - Q${quarter} ${year}`;
          const message = `Hi ${userName}, friendly reminder to upload condition images for your assets: ${assetNames}${additionalText}. Up to 5 images per asset are allowed.`;

          await notificationApi.createNotification({
            user_id: userId,
            title,
            message,
            type: 'asset_quarterly_upload_reminder',
            data: {
              quarter,
              year,
              assetCount,
              assets,
              isReminder: true
            }
          });

          remindersSent++;
        }
      }

      return { success: true, remindersSent, overduesSent };

    } catch (error: any) {
      console.error('Error checking and notifying pending uploads:', error);
      return { 
        success: false, 
        remindersSent: 0, 
        overduesSent: 0,
        error: error.message 
      };
    }
  }

  /**
   * Schedule quarterly notifications (to be called by a cron job or similar)
   */
  static async scheduleQuarterlyNotifications(): Promise<{ success: boolean; error?: string }> {
    try {
      // This would typically be called at the beginning of each quarter
      const result = await this.sendQuarterlyUploadReminders();
      
      if (!result.success) {
        return { success: false, error: result.error };
      }

      console.log(`Quarterly asset upload notifications sent to ${result.notificationsSent} users`);
      
      return { success: true };

    } catch (error: any) {
      console.error('Error scheduling quarterly notifications:', error);
      return { success: false, error: error.message };
    }
  }
}
