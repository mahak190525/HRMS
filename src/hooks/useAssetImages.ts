import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AssetImageUploadService } from '@/services/assetImageUpload';
import { AssetImageNotificationService } from '@/services/assetImageNotifications';
import { toast } from 'sonner';

// Hook to check upload eligibility
export function useUploadEligibility(assetAssignmentId: string, userId: string) {
  return useQuery({
    queryKey: ['assetImageUploadEligibility', assetAssignmentId, userId],
    queryFn: () => AssetImageUploadService.checkUploadEligibility(assetAssignmentId, userId),
    enabled: !!assetAssignmentId && !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Hook to get asset images
export function useAssetImages(assetAssignmentId: string, quarter?: number, year?: number) {
  return useQuery({
    queryKey: ['assetImages', assetAssignmentId, quarter, year],
    queryFn: () => AssetImageUploadService.getAssetImages(assetAssignmentId, quarter, year),
    enabled: !!assetAssignmentId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Hook to upload asset images
export function useUploadAssetImages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      files, 
      assetAssignmentId, 
      userId 
    }: { 
      files: File[]; 
      assetAssignmentId: string; 
      userId: string; 
    }) => AssetImageUploadService.uploadAssetImages(files, assetAssignmentId, userId),
    onSuccess: (result, variables) => {
      if (result.success) {
        // Invalidate related queries to refresh data
        queryClient.invalidateQueries({ 
          queryKey: ['assetImages', variables.assetAssignmentId] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ['assetImageUploadEligibility', variables.assetAssignmentId, variables.userId] 
        });

        toast.success(`Successfully uploaded ${result.uploadedImages?.length || 0} image(s)`);
        
        if (result.errors && result.errors.length > 0) {
          toast.warning(`Some uploads had issues: ${result.errors.join('; ')}`);
        }
      } else {
        toast.error(result.error || 'Upload failed');
      }
    },
    onError: (error: any) => {
      console.error('Upload mutation error:', error);
      toast.error(`Upload failed: ${error.message || 'Unknown error'}`);
    },
  });
}

// Hook to delete asset image
export function useDeleteAssetImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ imageId, userId }: { imageId: string; userId: string }) => 
      AssetImageUploadService.deleteAssetImage(imageId, userId),
    onSuccess: (result, variables) => {
      if (result.success) {
        // Invalidate all asset image queries to refresh the lists
        queryClient.invalidateQueries({ queryKey: ['assetImages'] });
        queryClient.invalidateQueries({ queryKey: ['assetImageUploadEligibility'] });
        
        toast.success('Image deleted successfully');
      } else {
        toast.error(result.error || 'Failed to delete image');
      }
    },
    onError: (error: any) => {
      console.error('Delete mutation error:', error);
      toast.error(`Delete failed: ${error.message || 'Unknown error'}`);
    },
  });
}

// Hook to get users needing quarterly upload (for admin/HR use)
export function useUsersNeedingQuarterlyUpload() {
  return useQuery({
    queryKey: ['usersNeedingQuarterlyUpload'],
    queryFn: () => AssetImageUploadService.getUsersNeedingQuarterlyUpload(),
    staleTime: 1000 * 60 * 10, // 10 minutes
    refetchInterval: 1000 * 60 * 30, // Refetch every 30 minutes
  });
}

// Hook to send quarterly upload reminders (for admin/HR use)
export function useSendQuarterlyReminders() {
  return useMutation({
    mutationFn: () => AssetImageNotificationService.sendQuarterlyUploadReminders(),
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Quarterly reminders sent to ${result.notificationsSent} users`);
        
        if (result.errors && result.errors.length > 0) {
          toast.warning(`Some notifications had issues: ${result.errors.join('; ')}`);
        }
      } else {
        toast.error(result.error || 'Failed to send reminders');
      }
    },
    onError: (error: any) => {
      console.error('Send reminders error:', error);
      toast.error(`Failed to send reminders: ${error.message || 'Unknown error'}`);
    },
  });
}

// Hook to check and notify pending uploads (for scheduled tasks)
export function useCheckPendingUploads() {
  return useMutation({
    mutationFn: () => AssetImageNotificationService.checkAndNotifyPendingUploads(),
    onSuccess: (result) => {
      if (result.success) {
        const totalSent = result.remindersSent + result.overduesSent;
        if (totalSent > 0) {
          toast.success(`Sent ${result.remindersSent} reminders and ${result.overduesSent} overdue notifications`);
        } else {
          toast.info('No pending upload notifications needed');
        }
      } else {
        toast.error(result.error || 'Failed to check pending uploads');
      }
    },
    onError: (error: any) => {
      console.error('Check pending uploads error:', error);
      toast.error(`Failed to check pending uploads: ${error.message || 'Unknown error'}`);
    },
  });
}

// Hook to send upload confirmation notification
export function useSendUploadConfirmation() {
  return useMutation({
    mutationFn: ({ 
      userId, 
      assetName, 
      assetTag, 
      imageCount 
    }: { 
      userId: string; 
      assetName: string; 
      assetTag: string; 
      imageCount: number; 
    }) => AssetImageNotificationService.sendUploadConfirmationNotification(
      userId, 
      assetName, 
      assetTag, 
      imageCount
    ),
    onSuccess: (result) => {
      if (!result.success) {
        console.warn('Failed to send upload confirmation notification:', result.error);
      }
    },
    onError: (error: any) => {
      console.error('Send upload confirmation error:', error);
    },
  });
}
