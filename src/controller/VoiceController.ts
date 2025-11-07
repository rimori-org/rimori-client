export async function getSTTResponse(backendUrl: string, audio: Blob, token: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', audio);

  return await fetch(`${backendUrl}/voice/stt`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
    .then((r) => r.json())
    .then((r) => {
      // console.log("STT response: ", r);
      return r.text;
    });
}

export async function getTTSResponse(backendUrl: string, request: TTSRequest, token: string): Promise<Blob> {
  return await fetch(`${backendUrl}/voice/tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  }).then((r) => r.blob());
}

interface TTSRequest {
  input: string;
  voice: string;
  speed: number;
  language?: string;
}
