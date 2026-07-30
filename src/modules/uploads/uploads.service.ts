import './cloudinary.config';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { UploadApiResponse, v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

/** Allow-listed image types, checked using their real file signatures. */
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const DEFAULT_SIGNED_URL_EXPIRY_SECONDS = 10 * 60; // 10 minutes

interface CloudinaryAssetReference {
  publicId: string;
  format: string;
  deliveryType: 'upload' | 'private' | 'authenticated';
}

@Injectable()
export class UploadsService {
  /**
   * Validates an image before uploading it.
   *
   * Validation includes:
   * - non-empty file
   * - maximum file size
   * - actual file type using magic bytes
   */
  private async validateImage(file: Express.Multer.File): Promise<void> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Uploaded file is empty');
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new BadRequestException(
        `File too large — max ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB`,
      );
    }

    const { fileTypeFromBuffer } = await import('file-type');
    const detected = await fileTypeFromBuffer(file.buffer);

    if (!detected || !ALLOWED_IMAGE_MIME_TYPES.has(detected.mime)) {
      throw new BadRequestException(
        'File content does not match an allowed image type (jpeg, png, webp). ' +
          'The file extension or declared content-type is not trusted — only ' +
          "the file's actual bytes are checked.",
      );
    }
  }

  /**
   * Uploads a validated image to Cloudinary.
   */
  async uploadImage(
    file: Express.Multer.File,
    folder = 'kyc',
  ): Promise<{
    url: string;
    publicId: string;
  }> {
    await this.validateImage(file);

    try {
      const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: 'image',
          },
          (error, uploadResult) => {
            if (error) {
              return reject(new Error(error.message));
            }

            if (!uploadResult) {
              return reject(new Error('Upload failed'));
            }

            resolve(uploadResult);
          },
        );

        Readable.from(file.buffer).pipe(stream);
      });

      return {
        url: result.secure_url,
        publicId: result.public_id,
      };
    } catch (error: unknown) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException(
        'Failed to upload image to Cloudinary',
      );
    }
  }

  /**
   * Generates a time-limited signed Cloudinary URL.
   *
   * The default expiry time is 10 minutes.
   */
  generateSignedDownloadUrl(
    assetUrl: string,
    expiresInSeconds = DEFAULT_SIGNED_URL_EXPIRY_SECONDS,
  ): string {
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds <= 0) {
      throw new BadRequestException(
        'Signed URL expiry must be a positive number of seconds',
      );
    }

    const { publicId, format, deliveryType } =
      this.extractCloudinaryAssetReference(assetUrl);

    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;

    try {
      return cloudinary.utils.private_download_url(publicId, format, {
        resource_type: 'image',
        type: deliveryType,
        expires_at: expiresAt,
        attachment: false,
      });
    } catch {
      throw new InternalServerErrorException(
        'Unable to generate secure KYC image URL',
      );
    }
  }

  /**
   * Extracts the public ID, format and delivery type from a Cloudinary URL.
   *
   * Example:
   * https://res.cloudinary.com/demo/image/upload/v123/kyc/documents/doc.jpg
   *
   * Result:
   * {
   *   publicId: 'kyc/documents/doc',
   *   format: 'jpg',
   *   deliveryType: 'upload'
   * }
   */
  private extractCloudinaryAssetReference(
    assetUrl: string,
  ): CloudinaryAssetReference {
    try {
      const parsedUrl = new URL(assetUrl);

      if (parsedUrl.protocol !== 'https:') {
        throw new Error('Cloudinary URL must use HTTPS');
      }

      if (
        parsedUrl.hostname !== 'res.cloudinary.com' &&
        !parsedUrl.hostname.endsWith('.res.cloudinary.com')
      ) {
        throw new Error('URL is not a Cloudinary delivery URL');
      }

      const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);

      const deliveryTypes = ['upload', 'private', 'authenticated'] as const;

      const deliveryTypeIndex = pathSegments.findIndex((segment) =>
        deliveryTypes.includes(segment as (typeof deliveryTypes)[number]),
      );

      if (deliveryTypeIndex === -1) {
        throw new Error('Unsupported Cloudinary delivery type');
      }

      const deliveryType = pathSegments[
        deliveryTypeIndex
      ] as CloudinaryAssetReference['deliveryType'];

      let assetSegments = pathSegments.slice(deliveryTypeIndex + 1);

      if (/^v\d+$/.test(assetSegments[0] ?? '')) {
        assetSegments = assetSegments.slice(1);
      }

      if (assetSegments.length === 0) {
        throw new Error('Cloudinary asset path is missing');
      }

      const assetPath = decodeURIComponent(assetSegments.join('/'));
      const extensionIndex = assetPath.lastIndexOf('.');

      if (extensionIndex <= 0 || extensionIndex === assetPath.length - 1) {
        throw new Error('Cloudinary asset format is missing');
      }

      const publicId = assetPath.slice(0, extensionIndex);
      const format = assetPath.slice(extensionIndex + 1).toLowerCase();

      if (!publicId || !format) {
        throw new Error('Invalid Cloudinary asset reference');
      }

      return {
        publicId,
        format,
        deliveryType,
      };
    } catch {
      throw new InternalServerErrorException(
        'Unable to generate secure KYC image URL',
      );
    }
  }
}
