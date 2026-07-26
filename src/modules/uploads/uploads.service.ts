import './cloudinary.config';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { UploadApiResponse, v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

/** Allow-listed image types, by their real (magic-byte) signature. */
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

@Injectable()
export class UploadsService {
  /**
   * Validate a file BEFORE it's uploaded anywhere.
   *  1. Size check — cheap, do it first.
   *  2. Real type check via magic bytes (the `file-type` package sniffs the
   *     actual file signature from the buffer), NOT the client-supplied
   *     `file.mimetype` — that field comes straight from the request's
   *     Content-Type header, which a caller can set to anything regardless
   *     of what bytes they actually send. A renamed .exe with
   *     `Content-Type: image/png` passes multer's own mimetype check but
   *     fails this one, because its bytes don't start with a PNG signature.
   *
   * Centralized here (not in each controller) so every current and future
   * caller of uploadImage() gets the same real validation for free, instead
   * of each one re-implementing (or forgetting) it.
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

    // file-type is ESM-only from v17+; dynamic import keeps this file
    // CommonJS-compatible (matches the rest of the NestJS build).
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
          (error, result) => {
            if (error) return reject(new Error(error.message));
            if (!result) return reject(new Error('Upload failed'));
            resolve(result);
          },
        );

        Readable.from(file.buffer).pipe(stream);
      });

      return {
        url: result.secure_url,
        publicId: result.public_id,
      };
    } catch (err) {
      // A BadRequestException from validateImage should never reach here,
      // but guard anyway so a real Cloudinary failure isn't masked.
      if (err instanceof BadRequestException) {
        throw err;
      }
      throw new InternalServerErrorException(
        'Failed to upload image to Cloudinary',
      );
    }
  }
}
