# Asset Image Upload Implementation

## Overview

This implementation adds quarterly asset condition image upload functionality for hardware assets in the HRMS system. Users with assigned hardware assets are required to upload up to 5 images per quarter to document asset condition.

## Features Implemented

### 1. Database Schema
- **Table**: `asset_condition_images`
  - Stores quarterly image uploads linked to asset assignments
  - Tracks upload quarter, year, and file metadata
  - Enforces unique constraints and data integrity
  - Includes RLS policies for security

### 2. Backend Services

#### AssetImageUploadService (`src/services/assetImageUpload.ts`)
- **File Validation**: Image types (JPEG, PNG, WebP), size limits (10MB)
- **Upload Management**: Handles up to 5 images per quarter per asset
- **Storage Integration**: Uses Supabase 'asset-condition-images' bucket
- **Unique Naming**: Generates unique filenames with asset tag, quarter, year
- **Eligibility Checking**: Validates hardware assets and upload limits
- **Image Management**: Upload, retrieve, and delete functionality

#### AssetImageNotificationService (`src/services/assetImageNotifications.ts`)
- **Quarterly Reminders**: Automated notifications at start of each quarter
- **Upload Confirmations**: Success notifications after image uploads
- **Overdue Alerts**: Urgent notifications for late uploads
- **Batch Processing**: Handles notifications for multiple users efficiently

### 3. Frontend Components

#### AssetImageUpload Component (`src/components/assets/AssetImageUpload.tsx`)
- **File Selection**: Multi-file upload with preview
- **Upload Progress**: Real-time feedback and loading states
- **Image Gallery**: Grid view of uploaded images with delete options
- **Eligibility Display**: Shows current upload status and limits
- **Hardware Detection**: Only shows for hardware assets (excludes software/licenses)

#### Integration in AssetManagement
- Added to asset assignment details dialog
- Only visible to asset assignees for their own assets
- Contextual display based on asset type and assignment status

### 4. React Query Hooks (`src/hooks/useAssetImages.ts`)
- **useUploadEligibility**: Checks if user can upload more images
- **useAssetImages**: Fetches existing images for an assignment
- **useUploadAssetImages**: Handles image upload with optimistic updates
- **useDeleteAssetImage**: Removes images with cache invalidation
- **Administrative hooks**: For HR/admin to manage notifications

## Technical Details

### Storage Structure
```
asset-condition-images/
├── {AssetTag}/
│   ├── Q1_2024/
│   │   ├── {AssetTag}_Q1_2024_{timestamp}_{uuid}.jpg
│   │   └── ...
│   ├── Q2_2024/
│   └── ...
```

### Notification Types
- `asset_quarterly_upload_reminder`: Quarterly upload reminders
- `asset_images_uploaded`: Upload confirmation
- `asset_upload_overdue`: Overdue upload warnings

### Security
- **RLS Policies**: Users can only access their own images
- **File Validation**: Strict type and size checking
- **User Verification**: Assignment ownership validation
- **Admin Access**: HR/admin can view all images

## Usage

### For Employees
1. Navigate to Asset Management → Asset Assignments
2. Click "View" on any assigned hardware asset
3. Scroll to "Asset Condition Images" section
4. Upload 1-5 images per quarter documenting asset condition
5. Receive confirmation notifications

### For HR/Admin
- Monitor upload compliance through notifications
- Send quarterly reminders to users
- Access all uploaded images for audit purposes

## Quarterly Workflow

1. **Quarter Start**: System sends automatic reminders to users with hardware assets
2. **During Quarter**: Users upload images as needed (max 5 per asset)
3. **Mid-Quarter**: Optional reminder notifications
4. **Quarter End**: Overdue notifications for non-compliant users

## Database Functions

- `get_current_quarter()`: Returns current quarter (1-4)
- `check_quarterly_upload_needed()`: Identifies users needing uploads
- RLS policies ensure data security and proper access control

## Integration Points

- **Supabase Storage**: 'asset-condition-images' bucket (must be created)
- **Notification System**: Extends existing notification framework
- **Asset Management**: Seamlessly integrated into existing UI
- **React Query**: Optimistic updates and caching

## Future Enhancements

- **Automated Compliance Reports**: Generate quarterly compliance reports
- **Image Comparison**: Compare images across quarters for asset deterioration
- **Mobile App Support**: Extend to mobile applications
- **Bulk Operations**: Admin tools for bulk image management
- **Analytics Dashboard**: Usage statistics and compliance metrics
