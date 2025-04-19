import { SupabaseClient } from "@supabase/supabase-js";

export async function getSTTResponse(supabase: SupabaseClient, audio: Blob) {
    const formData = new FormData();
    formData.append('file', audio);

    return await supabase.functions.invoke('speech', { method: 'POST', body: formData }).then(({ data }) => data.text);
}

export async function getTTSResponse(supabaseUrl: string, request: TTSRequest, token: string) {
    return await fetch(`${supabaseUrl}/functions/v1/speech`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(request),
    }).then(r => r.blob());
}

interface TTSRequest {
    input: string;
    voice: string;
    speed: number;
    language?: string;
}