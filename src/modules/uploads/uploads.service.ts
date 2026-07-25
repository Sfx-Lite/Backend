import './cloudinary.config';
import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { UploadApiResponse, v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class UploadsService {
  async uploadImage(
    file: Express.Multer.File,
    folder = 'kyc',
  ): Promise<{
    url: string;
    publicId: string;
  }> {
    try {
      const result = await new Promise<UploadApiResponse>(
        (resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder,
              resource_type: 'image',
            },
            (error, result) => {
              if (error) return reject(error);
              if (!result) return reject(new Error('Upload failed'));
              resolve(result);
            },
          );

          Readable.from(file.buffer).pipe(stream);
        },
      );

      return {
        url: result.secure_url,
        publicId: result.public_id,
      };
    } catch {
      throw new InternalServerErrorException(
        'Failed to upload image to Cloudinary',
      );
    }
  }
}