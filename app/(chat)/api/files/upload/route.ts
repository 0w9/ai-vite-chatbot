import { Client } from 'pg';
import { NextResponse } from 'next/server';
import { z } from 'zod';

// Use Blob instead of File since File is not available in Node.js environment
const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= 5 * 1024 * 1024, {
      message: 'File size should be less than 5MB',
    })
    // Update the file type based on the kind of files you want to accept
    .refine((file) => ['image/jpeg', 'image/png'].includes(file.type), {
      message: 'File type should be JPEG or PNG',
    }),
});

// Initialize Postgres client
const client = new Client({
  connectionString: process.env.POSTGRES_URL,
});
await client.connect();

export async function POST(request: Request) {
  if (request.body === null) {
    return new Response('Request body is empty', { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as Blob;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const validatedFile = FileSchema.safeParse({ file });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.errors
        .map((error) => error.message)
        .join(', ');

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    // Get filename from formData since Blob doesn't have name property
    const filename = (formData.get('file') as File).name;
    const fileBuffer = await file.arrayBuffer();

    try {
      // Insert file into Postgres
      const query = 'INSERT INTO files (name, content) VALUES ($1, $2) RETURNING id';
      const values = [filename, Buffer.from(fileBuffer)];
      const result = await client.query(query, values);

      return NextResponse.json({ id: result.rows[0].id, message: 'File uploaded successfully' });
    } catch (error) {
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    } finally {
      await client.end();
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 },
    );
  }
}
