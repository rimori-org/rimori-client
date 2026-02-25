/**
 * Storage module for plugin image operations.
 *
 * Handles uploading images to Supabase storage via the backend.
 *
 * Images are tracked automatically: the backend cron scans markdown columns
 * (declared via `type: 'markdown'` in db.config.ts) every 30 minutes,
 * confirms images found in content, and deletes orphaned ones. No plugin-side
 * confirm or delete calls are needed.
 */
export class StorageModule {
  constructor(
    private readonly backendUrl: string,
    private readonly getToken: () => string,
  ) {}

  /**
   * Upload a PNG image blob to Supabase storage via the backend.
   *
   * The image is initially "unconfirmed". The background cron will link it to
   * the entry automatically when it scans the markdown column after the entry
   * is saved (within ~30 minutes).
   *
   * @returns `{ data: { url, path } }` on success, `{ error }` on failure.
   */
  async uploadImage(
    pngBlob: Blob,
  ): Promise<{ data: { url: string; path: string }; error?: undefined } | { data?: undefined; error: Error }> {
    const formData = new FormData();
    formData.append('file', pngBlob, 'image.png');
    try {
      const response = await fetch(`${this.backendUrl}/plugin-images/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.getToken()}` },
        body: formData,
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        return { error: new Error(body.message ?? `Upload failed (${response.status})`) };
      }

      const result = (await response.json()) as { url: string; path: string };
      return { data: result };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  }
}
