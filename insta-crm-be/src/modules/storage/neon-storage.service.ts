import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AwsClient } from "aws4fetch";

@Injectable()
export class NeonStorageService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Uploads a private object to the branch-scoped Neon bucket.
   *
   * @param key - Tenant-scoped object key.
   * @param body - Object bytes.
   * @param contentType - MIME type stored with the object.
   * @returns The uploaded object key.
   * @throws ServiceUnavailableException when storage is not configured or rejects the upload.
   */
  async putObject(
    key: string,
    body: Uint8Array,
    contentType: string,
  ): Promise<string> {
    const response = await this.client().fetch(this.objectUrl(key), {
      method: "PUT",
      body: body as unknown as BodyInit,
      headers: { "content-type": contentType },
    });
    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Neon object upload failed with status ${response.status}`,
      );
    }
    return key;
  }

  /**
   * Deletes an object from the configured Neon bucket.
   *
   * @param key - Tenant-scoped object key.
   * @returns A promise that resolves after deletion.
   * @throws ServiceUnavailableException when storage is not configured or rejects the deletion.
   */
  async deleteObject(key: string): Promise<void> {
    const response = await this.client().fetch(this.objectUrl(key), {
      method: "DELETE",
    });
    if (!response.ok && response.status !== 404) {
      throw new ServiceUnavailableException(
        `Neon object deletion failed with status ${response.status}`,
      );
    }
  }

  /**
   * Creates a SigV4 client from Neon-provided S3 credentials.
   *
   * @returns A configured AWS-compatible request client.
   * @throws ServiceUnavailableException when required credentials are absent.
   */
  private client(): AwsClient {
    return new AwsClient({
      accessKeyId: this.required("AWS_ACCESS_KEY_ID"),
      secretAccessKey: this.required("AWS_SECRET_ACCESS_KEY"),
      service: "s3",
      region: this.config.get<string>("AWS_REGION", "us-east-2"),
    });
  }

  /**
   * Builds a path-style URL for an object in the private Neon bucket.
   *
   * @param key - Object key to encode.
   * @returns The complete object URL.
   * @throws ServiceUnavailableException when the endpoint is absent.
   */
  private objectUrl(key: string): string {
    const endpoint = this.required("AWS_ENDPOINT_URL_S3").replace(/\/+$/, "");
    const bucket = this.config.get<string>("NEON_STORAGE_BUCKET", "insta-crm");
    const encodedKey = key.split("/").map(encodeURIComponent).join("/");
    return `${endpoint}/${encodeURIComponent(bucket)}/${encodedKey}`;
  }

  /**
   * Reads a mandatory storage configuration value.
   *
   * @param name - Environment variable name.
   * @returns The configured non-empty value.
   * @throws ServiceUnavailableException when the variable is missing.
   */
  private required(name: string): string {
    const value = this.config.get<string>(name)?.trim();
    if (!value) {
      throw new ServiceUnavailableException(
        `Neon object storage is not configured: ${name} is missing`,
      );
    }
    return value;
  }
}
