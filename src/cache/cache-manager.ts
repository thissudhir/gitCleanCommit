import { writeFileSync, readFileSync, existsSync, mkdirSync, statSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { GitCleanError } from "../types/index.js";
import crypto from "crypto";

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
  checksum?: string;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum cache size in bytes
  maxEntries?: number; // Maximum number of entries
  checkIntegrity?: boolean; // Verify data integrity with checksums
}

export class CacheManager {
  private static readonly CACHE_DIR = join(homedir(), '.gitclean', 'cache');
  private static readonly DEFAULT_TTL = 60 * 60 * 1000; // 1 hour
  private static readonly MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB
  private static readonly MAX_ENTRIES = 1000;

  private static hits = 0;
  private static misses = 0;

  private static ensureCacheDir(): void {
    if (!existsSync(this.CACHE_DIR)) {
      mkdirSync(this.CACHE_DIR, { recursive: true });
    }
  }

  private static generateCacheKey(namespace: string, key: string, version?: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(`${namespace}:${key}:${version || 'default'}`);
    return hash.digest('hex').substring(0, 16);
  }

  private static getCachePath(cacheKey: string): string {
    return join(this.CACHE_DIR, `${cacheKey}.json`);
  }

  private static calculateChecksum(data: any): string {
    const hash = crypto.createHash('md5');
    hash.update(JSON.stringify(data));
    return hash.digest('hex');
  }

  public static set<T>(
    namespace: string,
    key: string,
    data: T,
    options: CacheOptions = {}
  ): void {
    try {
      this.ensureCacheDir();

      const ttl = options.ttl || this.DEFAULT_TTL;
      const cacheKey = this.generateCacheKey(namespace, key);
      const cachePath = this.getCachePath(cacheKey);

      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
        key: `${namespace}:${key}`,
        checksum: options.checkIntegrity ? this.calculateChecksum(data) : undefined
      };

      writeFileSync(cachePath, JSON.stringify(entry, null, 2));

      // Cleanup old entries if needed
      this.cleanupOldEntries();
    } catch (error) {
      // Cache errors should not break the application
      console.warn(`Cache write failed for ${namespace}:${key}:`, error);
    }
  }

  public static get<T>(
    namespace: string,
    key: string,
    version?: string
  ): T | null {
    try {
      const cacheKey = this.generateCacheKey(namespace, key, version);
      const cachePath = this.getCachePath(cacheKey);

      if (!existsSync(cachePath)) {
        this.misses++;
        return null;
      }

      const fileContent = readFileSync(cachePath, 'utf8');
      const entry: CacheEntry<T> = JSON.parse(fileContent);

      // Check if entry has expired
      if (Date.now() - entry.timestamp > entry.ttl) {
        this.misses++;
        this.delete(namespace, key, version);
        return null;
      }

      // Verify data integrity if checksum is available
      if (entry.checksum) {
        const currentChecksum = this.calculateChecksum(entry.data);
        if (currentChecksum !== entry.checksum) {
          console.warn(`Cache integrity check failed for ${namespace}:${key}`);
          this.misses++;
          this.delete(namespace, key, version);
          return null;
        }
      }

      this.hits++;
      return entry.data;
    } catch (error) {
      console.warn(`Cache read failed for ${namespace}:${key}:`, error);
      this.misses++;
      return null;
    }
  }

  public static has(namespace: string, key: string, version?: string): boolean {
    const cacheKey = this.generateCacheKey(namespace, key, version);
    const cachePath = this.getCachePath(cacheKey);

    if (!existsSync(cachePath)) {
      return false;
    }

    try {
      const fileContent = readFileSync(cachePath, 'utf8');
      const entry: CacheEntry = JSON.parse(fileContent);

      // Check if entry has expired
      return Date.now() - entry.timestamp <= entry.ttl;
    } catch {
      return false;
    }
  }

  public static delete(namespace: string, key: string, version?: string): boolean {
    try {
      const cacheKey = this.generateCacheKey(namespace, key, version);
      const cachePath = this.getCachePath(cacheKey);

      if (existsSync(cachePath)) {
        require('fs').unlinkSync(cachePath);
        return true;
      }
      return false;
    } catch (error) {
      console.warn(`Cache delete failed for ${namespace}:${key}:`, error);
      return false;
    }
  }

  public static clear(namespace?: string): number {
    try {
      this.ensureCacheDir();

      const files = require('fs').readdirSync(this.CACHE_DIR);
      let deletedCount = 0;

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = join(this.CACHE_DIR, file);

        if (namespace) {
          try {
            const content = readFileSync(filePath, 'utf8');
            const entry: CacheEntry = JSON.parse(content);

            if (entry.key.startsWith(`${namespace}:`)) {
              require('fs').unlinkSync(filePath);
              deletedCount++;
            }
          } catch {
            // If we can't parse the file, delete it anyway
            require('fs').unlinkSync(filePath);
            deletedCount++;
          }
        } else {
          require('fs').unlinkSync(filePath);
          deletedCount++;
        }
      }

      return deletedCount;
    } catch (error) {
      console.warn('Cache clear failed:', error);
      return 0;
    }
  }

  public static getStats(): CacheStats {
    try {
      this.ensureCacheDir();

      const files = require('fs').readdirSync(this.CACHE_DIR);
      let totalSize = 0;
      let totalEntries = 0;
      let oldestEntry: Date | undefined;
      let newestEntry: Date | undefined;

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = join(this.CACHE_DIR, file);
        const stats = statSync(filePath);
        totalSize += stats.size;
        totalEntries++;

        if (!oldestEntry || stats.mtime < oldestEntry) {
          oldestEntry = stats.mtime;
        }
        if (!newestEntry || stats.mtime > newestEntry) {
          newestEntry = stats.mtime;
        }
      }

      const totalRequests = this.hits + this.misses;
      const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;
      const missRate = totalRequests > 0 ? (this.misses / totalRequests) * 100 : 0;

      return {
        totalEntries,
        totalSize,
        hitRate,
        missRate,
        oldestEntry,
        newestEntry
      };
    } catch (error) {
      return {
        totalEntries: 0,
        totalSize: 0,
        hitRate: 0,
        missRate: 0
      };
    }
  }

  private static cleanupOldEntries(): void {
    try {
      const stats = this.getStats();

      // Clean up if we exceed limits
      if (stats.totalSize > this.MAX_CACHE_SIZE || stats.totalEntries > this.MAX_ENTRIES) {
        const files = require('fs').readdirSync(this.CACHE_DIR);
        const fileStats: Array<{ path: string; mtime: Date; size: number }> = [];

        for (const file of files) {
          if (!file.endsWith('.json')) continue;

          const filePath = join(this.CACHE_DIR, file);
          const stat = statSync(filePath);
          fileStats.push({
            path: filePath,
            mtime: stat.mtime,
            size: stat.size
          });
        }

        // Sort by oldest first
        fileStats.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());

        // Delete oldest files until we're under limits
        let currentSize = stats.totalSize;
        let currentEntries = stats.totalEntries;

        for (const fileInfo of fileStats) {
          if (currentSize <= this.MAX_CACHE_SIZE && currentEntries <= this.MAX_ENTRIES) {
            break;
          }

          try {
            require('fs').unlinkSync(fileInfo.path);
            currentSize -= fileInfo.size;
            currentEntries--;
          } catch {
            // Ignore errors when deleting individual files
          }
        }
      }
    } catch (error) {
      console.warn('Cache cleanup failed:', error);
    }
  }

  public static cleanupExpired(): number {
    try {
      this.ensureCacheDir();

      const files = require('fs').readdirSync(this.CACHE_DIR);
      let deletedCount = 0;

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = join(this.CACHE_DIR, file);

        try {
          const content = readFileSync(filePath, 'utf8');
          const entry: CacheEntry = JSON.parse(content);

          if (Date.now() - entry.timestamp > entry.ttl) {
            require('fs').unlinkSync(filePath);
            deletedCount++;
          }
        } catch {
          // If we can't parse the file, delete it
          require('fs').unlinkSync(filePath);
          deletedCount++;
        }
      }

      return deletedCount;
    } catch (error) {
      console.warn('Expired cache cleanup failed:', error);
      return 0;
    }
  }

  // Specialized cache methods for common GitClean operations
  public static cacheGitStatus(status: string, repoPath: string): void {
    const key = `git-status:${repoPath}`;
    this.set('git', key, status, { ttl: 5000 }); // 5 seconds TTL for git status
  }

  public static getCachedGitStatus(repoPath: string): string | null {
    const key = `git-status:${repoPath}`;
    return this.get('git', key);
  }

  public static cacheSpellCheckResult(word: string, result: any): void {
    this.set('spellcheck', word.toLowerCase(), result, { ttl: 24 * 60 * 60 * 1000 }); // 24 hours
  }

  public static getCachedSpellCheckResult(word: string): any | null {
    return this.get('spellcheck', word.toLowerCase());
  }

  public static cacheCommitHistory(repoPath: string, history: any[]): void {
    const key = `commit-history:${repoPath}`;
    this.set('git', key, history, { ttl: 10 * 60 * 1000 }); // 10 minutes
  }

  public static getCachedCommitHistory(repoPath: string): any[] | null {
    const key = `commit-history:${repoPath}`;
    return this.get('git', key);
  }

  public static cacheFileAnalysis(filePath: string, analysis: any): void {
    // Use file modification time as version for invalidation
    try {
      const stats = statSync(filePath);
      const version = stats.mtime.getTime().toString();
      this.set('analysis', filePath, analysis, { ttl: 60 * 60 * 1000 }); // 1 hour
    } catch {
      // File doesn't exist, don't cache
    }
  }

  public static getCachedFileAnalysis(filePath: string): any | null {
    try {
      const stats = statSync(filePath);
      const version = stats.mtime.getTime().toString();
      return this.get('analysis', filePath, version);
    } catch {
      return null;
    }
  }
}