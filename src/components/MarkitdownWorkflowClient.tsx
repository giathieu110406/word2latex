import { client } from 'workflow';

export const handleMarkItDownConversion = async (fileUrl: string, userId: string, docId: string) => {
  // 3. Trigger the workflow (Fire and forget)
  await client.trigger('markitdown-job', {
    userId,
    fileUrl,
    docId
  });

  console.log("Triggered MarkItDown durable workflow for doc:", docId);
  return { status: 'processing', processingId: docId };
};
