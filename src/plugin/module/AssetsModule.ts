/**
 * Assets module for the `plugin-assets` Supabase bucket.
 *
 * Use this to upload files (image|audio|video|file) whose URL is stored in a
 * matching `type: 'image' | 'audio' | 'video' | 'file'` column in db.config.ts.
 *
 * Lifecycle is automatic: the backend asset-refs cron links the upload to the
 * row whose column value matches the returned URL (within ~30 minutes), and
 * deletes the file when the row is removed or the column is replaced/cleared.
 * No plugin-side confirm or delete call is needed.
 *
 * For markdown editor images (embedded as `![](url)` in markdown text), use
 * `plugin.storage.uploadImage` instead — that has a different lifecycle (regex
 * scan over markdown bodies) and lives in the separate `plugin-images` bucket.
 */
import { RimoriCommunicationHandler } from '../CommunicationHandler';

export type AssetKind = 'image' | 'audio' | 'video' | 'file';

export class AssetsModule {
  constructor(private readonly controller: RimoriCommunicationHandler) {}

  /**
   * Upload a blob as an asset of the given kind.
   *
   * @returns `{ data: { url, path } }` on success, `{ error }` on failure.
   *   Store `url` in the matching asset-typed column on your row. The cron
   *   will pick it up on the next tick and confirm the ref.
   */
  async upload(
    blob: Blob,
    options: { kind: AssetKind; filename?: string },
  ): Promise<{ data: { url: string; path: string }; error?: undefined } | { data?: undefined; error: Error }> {
    const formData = new FormData();
    const filename = options.filename ?? `asset.${options.kind}`;
    formData.append('file', blob, filename);
    formData.append('kind', options.kind);

    try {
      const response = await this.controller.fetchBackend('/plugin-assets/upload', {
        method: 'POST',
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
