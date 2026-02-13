import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

// Define the Multer file type interface
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  stream?: any;
  destination?: string;
  filename?: string;
  path?: string;
}

@Injectable()
export class StorageService {
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  private bucket = process.env.SUPABASE_BUCKET!;

  async uploadFile(file: MulterFile): Promise<string> {
    const fileName = `${Date.now()}-${file.originalname}`;

    const { error } = await this.supabase.storage
      .from(this.bucket)
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
      });

    if (error) {
      throw new Error(error.message);
    }

    return fileName; // store only the key in DB
  }

  async getSignedUrl(fileName: string): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUrl(fileName, 60 * 60); // 10 minutes

    if (error) {
      throw new Error(error.message);
    }

    return data.signedUrl;
  }
}