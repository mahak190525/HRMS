import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Upload, Image as ImageIcon, X, Eye, AlertCircle, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { AssetImageUploadService } from '@/services/assetImageUpload';
import { AssetImageNotificationService } from '@/services/assetImageNotifications';
import { 
  useUploadEligibility, 
  useAssetImages, 
  useUploadAssetImages, 
  useDeleteAssetImage,
  useSendUploadConfirmation
} from '@/hooks/useAssetImages';

interface AssetImageUploadProps {
  assetAssignmentId: string;
  assetName: string;
  assetTag: string;
  userId: string;
  isHardwareAsset: boolean;
  viewOnly?: boolean;
  onUploadComplete?: () => void;
}

interface UploadedImage {
  id: string;
  image_url: string;
  image_filename: string;
  uploaded_at: string;
  image_size_bytes: number;
}

export function AssetImageUpload({
  assetAssignmentId,
  assetName,
  assetTag,
  userId,
  isHardwareAsset,
  viewOnly = false,
  onUploadComplete
}: AssetImageUploadProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Use custom hooks
  const { data: uploadEligibility, isLoading: eligibilityLoading } = useUploadEligibility(
    assetAssignmentId, 
    userId,
    { enabled: !viewOnly } // Only check eligibility if not in view-only mode
  );
  const { data: imagesResult, isLoading: imagesLoading } = useAssetImages(assetAssignmentId);
  const uploadMutation = useUploadAssetImages();
  const deleteMutation = useDeleteAssetImage();
  const sendConfirmationMutation = useSendUploadConfirmation();

  const uploadedImages = imagesResult?.success ? imagesResult.images : [];

  // Get current quarter and year
  const getCurrentQuarterInfo = () => {
    const now = new Date();
    const quarter = Math.floor((now.getMonth() + 3) / 3);
    const year = now.getFullYear();
    return { quarter, year };
  };


  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    if (files.length === 0) return;

    // Validate file count
    const currentUploadedCount = uploadedImages?.length || 0;
    const totalAfterUpload = currentUploadedCount + selectedFiles.length + files.length;
    if (totalAfterUpload > 5) {
      toast.error(`Cannot select ${files.length} more files. Maximum 5 images per quarter. You have ${currentUploadedCount} uploaded and ${selectedFiles.length} selected.`);
      return;
    }

    // Validate each file
    const validFiles: File[] = [];
    const errors: string[] = [];

    for (const file of files) {
      const validation = AssetImageUploadService.validateImageFile(file);
      if (validation.isValid) {
        validFiles.push(file);
      } else {
        errors.push(`${file.name}: ${validation.error}`);
      }
    }

    if (errors.length > 0) {
      toast.error(`Some files were rejected: ${errors.join('; ')}`);
    }

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }

    // Clear input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select images to upload');
      return;
    }

    try {
      const result = await uploadMutation.mutateAsync({
        files: selectedFiles,
        assetAssignmentId,
        userId
      });

      if (result.success) {
        // Clear selected files
        setSelectedFiles([]);

        // Send confirmation notification
        if (result.uploadedImages && result.uploadedImages.length > 0) {
          await sendConfirmationMutation.mutateAsync({
            userId,
            assetName,
            assetTag,
            imageCount: result.uploadedImages.length
          });
        }

        // Call completion callback
        if (onUploadComplete) {
          onUploadComplete();
        }
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      // Error handling is done in the mutation
    }
  };

  const deleteImage = async (imageId: string) => {
    try {
      await deleteMutation.mutateAsync({ imageId, userId });
    } catch (error: any) {
      console.error('Delete error:', error);
      // Error handling is done in the mutation
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const { quarter, year } = getCurrentQuarterInfo();

  if (!isHardwareAsset) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Asset Condition Images
          </CardTitle>
          <CardDescription>
            Image uploads are only required for hardware assets.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (eligibilityLoading || imagesLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Asset Condition Images - Q{quarter} {year}
        </CardTitle>
        <CardDescription>
          {viewOnly 
            ? `View quarterly condition images for hardware asset: ${assetName} (${assetTag})`
            : `Upload up to 5 images per quarter to document the condition of your assigned hardware asset: ${assetName} (${assetTag})`
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Eligibility Status - Only show if not in view-only mode */}
        {!viewOnly && uploadEligibility && (
          <div className={`p-3 rounded-lg ${uploadEligibility.canUpload ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
            <div className="flex items-center gap-2">
              {uploadEligibility.canUpload ? (
                <div className="text-green-600">
                  ✓ You can upload {uploadEligibility.maxAllowed - uploadEligibility.currentCount} more image(s) this quarter
                </div>
              ) : (
                <div className="text-yellow-600">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  {uploadEligibility.error || `Upload limit reached (${uploadEligibility.currentCount}/${uploadEligibility.maxAllowed})`}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Existing Images */}
        {uploadedImages && uploadedImages.length > 0 && (
          <div>
            <Label className="text-sm font-medium">Uploaded Images ({uploadedImages.length}/5)</Label>
            <div className="space-y-2 mt-2">
              {uploadedImages.map((image, index) => (
                <div key={image.id} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <ImageIcon className="h-4 w-4 text-blue-600" />
                    </div>
                    <div>
                      <span className="font-medium text-sm">Image {index + 1}</span>
                      <div className="text-xs text-gray-500">
                        {formatFileSize(image.image_size_bytes || 0)} • {image.image_filename}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setViewImageUrl(image.image_url)}
                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* File Upload Section - Only show if not in view-only mode */}
        {!viewOnly && uploadEligibility?.canUpload && (
          <>
            <div>
              <Label htmlFor="images" className="text-sm font-medium">
                Select Images (JPEG, PNG, WebP - Max 10MB each)
              </Label>
              <Input
                ref={fileInputRef}
                id="images"
                type="file"
                multiple
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleFileSelect}
                className="mt-1"
              />
            </div>

            {/* Selected Files Preview */}
            {selectedFiles.length > 0 && (
              <div>
                <Label className="text-sm font-medium">Selected Files ({selectedFiles.length})</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="relative group">
                      <div className="aspect-square rounded-lg overflow-hidden border bg-gray-50">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="absolute top-1 right-1 h-6 w-6 p-0"
                        onClick={() => removeSelectedFile(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                      <div className="mt-1 text-xs text-gray-500 truncate">
                        {file.name} ({formatFileSize(file.size)})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Button */}
            <Button
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || uploadMutation.isPending}
              className="w-full"
            >
              {uploadMutation.isPending ? (
                <>
                  <LoadingSpinner className="mr-2" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload {selectedFiles.length > 0 ? `${selectedFiles.length} ` : ''}Image{selectedFiles.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </>
        )}

        {/* Image Viewer Dialog */}
        <Dialog open={!!viewImageUrl} onOpenChange={() => setViewImageUrl(null)}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Asset Condition Image</DialogTitle>
            </DialogHeader>
            {viewImageUrl && (
              <div className="flex justify-center">
                <img
                  src={viewImageUrl}
                  alt="Asset condition"
                  className="max-w-full max-h-96 object-contain rounded-lg"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
