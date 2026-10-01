'use workflow';

interface Payload {
  userId: string;
  fileUrl: string;
  docId: string;
}

export async function markItDownJob(payload: Payload) {
  const { userId, fileUrl, docId } = payload;

  const extractedText = await extractText();
  const latexResult = await callLlm(extractedText);
  await updateDb(userId, docId, latexResult);

  return { success: true, latexResult };
}

async function extractText() {
  'use step';
  return "Extracted content placeholder";
}

async function callLlm(text: string) {
  'use step';
  await new Promise(resolve => setTimeout(resolve, 100));
  return `\\LaTeX result for ${text}`;
}

async function updateDb(userId: string, docId: string, result: string) {
  'use step';
  console.log(`Updated Firestore doc ${docId} for user ${userId} with result: ${result}`);
}
