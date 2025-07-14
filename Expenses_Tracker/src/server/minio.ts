import { Client } from "minio";
import { getBaseUrl } from "./utils/base-url";

export const minioBaseUrl = getBaseUrl({ port: 9000 });

export const minioClient = new Client({
  endPoint: minioBaseUrl.split("://")[1]!,
  useSSL: minioBaseUrl.startsWith("https://"),
  accessKey: "admin",
  secretKey: process.env.ADMIN_PASSWORD!,
});
