import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  NotFound,
} from '@aws-sdk/client-s3';
import { S3AudioStorage, type S3Config } from './s3-audio-storage.js';

const s3 = vi.hoisted(() => ({
  clients: [] as { config: unknown; send: ReturnType<typeof vi.fn> }[],
  send: vi.fn(),
  createPresignedPost: vi.fn(),
  getSignedUrl: vi.fn(),
}));

vi.mock('@aws-sdk/client-s3', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@aws-sdk/client-s3')>();
  return {
    ...actual,
    S3Client: class {
      send = s3.send;
      constructor(config: unknown) {
        s3.clients.push({ config, send: s3.send });
      }
    },
  };
});
vi.mock('@aws-sdk/s3-presigned-post', () => ({ createPresignedPost: s3.createPresignedPost }));
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: s3.getSignedUrl }));

const CONFIG: S3Config = {
  endpoint: 'https://r2.test',
  region: 'auto',
  bucket: 'recordings',
  accessKeyId: 'AKIA_TEST',
  secretAccessKey: 'secret',
  forcePathStyle: true,
};

const commands = () => s3.send.mock.calls.map((c) => c[0] as { input: Record<string, unknown> });

describe('S3AudioStorage', () => {
  let storage: S3AudioStorage;

  beforeEach(() => {
    s3.clients.length = 0;
    s3.send.mockReset();
    s3.createPresignedPost.mockReset();
    s3.getSignedUrl.mockReset();
    storage = new S3AudioStorage(CONFIG);
  });

  it('builds one client from the config', () => {
    expect(s3.clients).toHaveLength(1);
    expect(s3.clients[0]?.config).toEqual({
      endpoint: 'https://r2.test',
      region: 'auto',
      forcePathStyle: true,
      credentials: { accessKeyId: 'AKIA_TEST', secretAccessKey: 'secret' },
    });
  });

  describe('presignUpload', () => {
    it('presigns a 5 min POST capped to [1, maxBytes] and locked to the content type', async () => {
      s3.createPresignedPost.mockResolvedValue({
        url: 'https://r2.test/recordings',
        fields: { key: 'audio/u/a', Policy: 'p' },
      });

      await expect(storage.presignUpload('audio/u/a', 'audio/webm', 1000)).resolves.toEqual({
        url: 'https://r2.test/recordings',
        fields: { key: 'audio/u/a', Policy: 'p' },
      });

      const [client, options] = s3.createPresignedPost.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
      ];
      expect(client).toBeDefined();
      expect(options).toEqual({
        Bucket: 'recordings',
        Key: 'audio/u/a',
        Conditions: [
          ['content-length-range', 1, 1000],
          ['eq', '$Content-Type', 'audio/webm'],
        ],
        Fields: { 'Content-Type': 'audio/webm' },
        Expires: 300,
      });
    });
  });

  describe('head', () => {
    it('returns the object size', async () => {
      s3.send.mockResolvedValue({ ContentLength: 4096 });
      await expect(storage.head('audio/u/a')).resolves.toEqual({ size: 4096 });
      const [command] = commands();
      expect(command).toBeInstanceOf(HeadObjectCommand);
      expect(command?.input).toEqual({ Bucket: 'recordings', Key: 'audio/u/a' });
    });

    it('reports size 0 when the length is missing', async () => {
      s3.send.mockResolvedValue({});
      await expect(storage.head('audio/u/a')).resolves.toEqual({ size: 0 });
    });

    it('returns null for NotFound', async () => {
      s3.send.mockRejectedValue(new NotFound({ message: 'not found', $metadata: {} }));
      await expect(storage.head('audio/u/a')).resolves.toBeNull();
    });

    it('returns null for any 404 (some S3-compatible stores send no NotFound)', async () => {
      s3.send.mockRejectedValue(
        Object.assign(new Error('Unknown'), { $metadata: { httpStatusCode: 404 } })
      );
      await expect(storage.head('audio/u/a')).resolves.toBeNull();
    });

    it.each([
      ['a 403', Object.assign(new Error('AccessDenied'), { $metadata: { httpStatusCode: 403 } })],
      ['a 500', Object.assign(new Error('Internal'), { $metadata: { httpStatusCode: 500 } })],
      ['a network error', new Error('ECONNRESET')],
    ])('rethrows %s', async (_label, error) => {
      s3.send.mockRejectedValue(error);
      await expect(storage.head('audio/u/a')).rejects.toBe(error);
    });
  });

  describe('presignDownload', () => {
    it('signs a GET of the object for 5 minutes', async () => {
      s3.getSignedUrl.mockResolvedValue('https://r2.test/recordings/audio/u/a?sig=1');
      await expect(storage.presignDownload('audio/u/a')).resolves.toBe(
        'https://r2.test/recordings/audio/u/a?sig=1'
      );
      const [, command, options] = s3.getSignedUrl.mock.calls[0] as [
        unknown,
        { input: unknown },
        unknown,
      ];
      expect(command).toBeInstanceOf(GetObjectCommand);
      expect(command.input).toEqual({ Bucket: 'recordings', Key: 'audio/u/a' });
      expect(options).toEqual({ expiresIn: 300 });
    });
  });

  describe('delete', () => {
    it('deletes one object of the bucket', async () => {
      s3.send.mockResolvedValue({});
      await storage.delete('audio/u/a');
      const [command] = commands();
      expect(command).toBeInstanceOf(DeleteObjectCommand);
      expect(command?.input).toEqual({ Bucket: 'recordings', Key: 'audio/u/a' });
    });

    it('propagates failures', async () => {
      s3.send.mockRejectedValue(new Error('denied'));
      await expect(storage.delete('audio/u/a')).rejects.toThrow('denied');
    });
  });

  describe('deletePrefix', () => {
    it('pages through continuation tokens and deletes each page', async () => {
      s3.send.mockImplementation(async (command: { input: Record<string, unknown> }) => {
        if (command instanceof ListObjectsV2Command) {
          if (command.input.ContinuationToken === undefined) {
            return {
              Contents: [{ Key: 'audio/u/1' }, { Key: 'audio/u/2' }],
              IsTruncated: true,
              NextContinuationToken: 'page-2',
            };
          }
          return { Contents: [{ Key: 'audio/u/3' }], IsTruncated: false };
        }
        return {};
      });

      await storage.deletePrefix('audio/u/');

      const sent = commands();
      expect(sent.map((c) => c.constructor)).toEqual([
        ListObjectsV2Command,
        DeleteObjectsCommand,
        ListObjectsV2Command,
        DeleteObjectsCommand,
      ]);
      expect(sent[0]?.input).toEqual({
        Bucket: 'recordings',
        Prefix: 'audio/u/',
        ContinuationToken: undefined,
      });
      expect(sent[1]?.input).toEqual({
        Bucket: 'recordings',
        Delete: { Objects: [{ Key: 'audio/u/1' }, { Key: 'audio/u/2' }] },
      });
      expect(sent[2]?.input).toEqual({
        Bucket: 'recordings',
        Prefix: 'audio/u/',
        ContinuationToken: 'page-2',
      });
      expect(sent[3]?.input).toEqual({
        Bucket: 'recordings',
        Delete: { Objects: [{ Key: 'audio/u/3' }] },
      });
    });

    it('skips empty pages and objects without a key, but keeps paging', async () => {
      s3.send.mockImplementation(async (command: { input: Record<string, unknown> }) => {
        if (!(command instanceof ListObjectsV2Command)) return {};
        if (command.input.ContinuationToken === undefined) {
          return { IsTruncated: true, NextContinuationToken: 'p2' };
        }
        if (command.input.ContinuationToken === 'p2') {
          return { Contents: [{}], IsTruncated: true, NextContinuationToken: 'p3' };
        }
        return { Contents: [{ Key: 'audio/u/9' }, {}], IsTruncated: false };
      });

      await storage.deletePrefix('audio/u/');

      const sent = commands();
      expect(sent.map((c) => c.constructor)).toEqual([
        ListObjectsV2Command,
        ListObjectsV2Command,
        ListObjectsV2Command,
        DeleteObjectsCommand,
      ]);
      expect(sent[3]?.input).toEqual({
        Bucket: 'recordings',
        Delete: { Objects: [{ Key: 'audio/u/9' }] },
      });
    });

    it('stops when the listing is not truncated, even with a stale token', async () => {
      s3.send.mockImplementation(async (command: unknown) =>
        command instanceof ListObjectsV2Command
          ? { Contents: [], IsTruncated: false, NextContinuationToken: 'ignored' }
          : {}
      );
      await storage.deletePrefix('audio/u/');
      expect(s3.send).toHaveBeenCalledTimes(1);
    });

    it('stops when a truncated listing carries no token', async () => {
      s3.send.mockResolvedValue({ Contents: [], IsTruncated: true });
      await storage.deletePrefix('audio/u/');
      expect(s3.send).toHaveBeenCalledTimes(1);
    });
  });
});
