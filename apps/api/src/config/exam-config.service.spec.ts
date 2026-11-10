import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import { ExamConfigService } from './exam-config.service.js';

const paths = vi.hoisted(() => ({ dir: '' }));
vi.mock('../paths.js', () => ({ getApiConfigDir: () => paths.dir }));

const AGENT_YAML = `
name: "Agent"
description: "Desc"
settings:
  allowInterruptions: true
baseInstructions: "Base v1"
instructions: "Instr v1"
greeting: "Bonjour"
`;

const SERVICE_YAML = `
llm:
  model: "realtime"
  voice: "alloy"
`;

describe('ExamConfigService', () => {
  let dir: string;
  let service: ExamConfigService;

  const write = (rel: string, content: string) => {
    const path = join(dir, rel);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, content, 'utf-8');
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'exam-config-'));
    paths.dir = dir;
    service = new ExamConfigService();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  describe('loadAgentConfig', () => {
    it('parses agents/<task>.yml', () => {
      write('agents/tache2.yml', AGENT_YAML);
      expect(service.loadAgentConfig('tache2')).toEqual({
        name: 'Agent',
        description: 'Desc',
        settings: { allowInterruptions: true },
        baseInstructions: 'Base v1',
        instructions: 'Instr v1',
        greeting: 'Bonjour',
      });
    });

    it('caches each task after the first read', () => {
      write('agents/tache2.yml', AGENT_YAML);
      const first = service.loadAgentConfig('tache2');
      write('agents/tache2.yml', AGENT_YAML.replace('Instr v1', 'Instr v2'));
      expect(service.loadAgentConfig('tache2')).toBe(first);
      expect(service.loadAgentConfig('tache2').instructions).toBe('Instr v1');
      // A fresh instance reads the file again.
      expect(new ExamConfigService().loadAgentConfig('tache2').instructions).toBe('Instr v2');
    });

    it('keeps one cache entry per task', () => {
      write('agents/tache2.yml', AGENT_YAML);
      write('agents/tache3.yml', AGENT_YAML.replace('Agent', 'Agent trois'));
      expect(service.loadAgentConfig('tache2').name).toBe('Agent');
      expect(service.loadAgentConfig('tache3').name).toBe('Agent trois');
    });

    it.each(['name', 'description', 'settings', 'baseInstructions', 'instructions', 'greeting'])(
      'rejects a file without %s',
      (field) => {
        const yaml = AGENT_YAML.split('\n')
          .filter((line) => !line.startsWith(`${field}:`) && !line.startsWith('  allowInter'))
          .join('\n');
        write('agents/tache3.yml', yaml);
        expect(() => service.loadAgentConfig('tache3')).toThrow(`Missing '${field}' in tache3.yml`);
      }
    );

    it('does not cache an invalid file', () => {
      write('agents/tache1.yml', AGENT_YAML.replace('greeting: "Bonjour"', ''));
      expect(() => service.loadAgentConfig('tache1')).toThrow("Missing 'greeting'");
      write('agents/tache1.yml', AGENT_YAML);
      expect(service.loadAgentConfig('tache1').greeting).toBe('Bonjour');
    });
  });

  describe('loadServiceConfig', () => {
    it('parses service.yml and caches it', () => {
      write('service.yml', SERVICE_YAML);
      const first = service.loadServiceConfig();
      expect(first.llm).toEqual({ model: 'realtime', voice: 'alloy' });
      write('service.yml', SERVICE_YAML.replace('alloy', 'marin'));
      expect(service.loadServiceConfig()).toBe(first);
      expect(service.loadServiceConfig().llm.voice).toBe('alloy');
    });

    it.each([
      ['llm.voice', 'llm:\n  model: "realtime"\n'],
      ['llm.model', 'llm:\n  voice: "alloy"\n'],
      ['llm', 'other: true\n'],
    ])('rejects a file without %s', (_label, yaml) => {
      write('service.yml', yaml);
      expect(() => service.loadServiceConfig()).toThrow(
        'service.yml: missing llm.voice or llm.model'
      );
    });

    it('does not cache an invalid file', () => {
      write('service.yml', 'llm:\n  model: "realtime"\n');
      expect(() => service.loadServiceConfig()).toThrow();
      write('service.yml', SERVICE_YAML);
      expect(service.loadServiceConfig().llm.voice).toBe('alloy');
    });
  });

  describe('loadInfoMarkdown', () => {
    it('reads info/<file> and caches it per file', () => {
      write('info/a.md', '# A v1');
      write('info/b.md', '# B');
      expect(service.loadInfoMarkdown('a.md')).toBe('# A v1');
      write('info/a.md', '# A v2');
      expect(service.loadInfoMarkdown('a.md')).toBe('# A v1');
      expect(service.loadInfoMarkdown('b.md')).toBe('# B');
    });

    it('caches an empty file too', () => {
      write('info/empty.md', '');
      expect(service.loadInfoMarkdown('empty.md')).toBe('');
      write('info/empty.md', 'now filled');
      expect(service.loadInfoMarkdown('empty.md')).toBe('');
    });

    it('does not read files outside info/', () => {
      write('a.md', 'root file');
      expect(service.loadInfoMarkdown('a.md')).toBeUndefined();
    });

    it('returns undefined and warns when the file is missing, without caching the miss', () => {
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      expect(service.loadInfoMarkdown('missing.md')).toBeUndefined();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[0]).toContain("'missing.md'");

      write('info/missing.md', 'arrived');
      expect(service.loadInfoMarkdown('missing.md')).toBe('arrived');
    });
  });
});
