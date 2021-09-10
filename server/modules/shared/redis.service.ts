import * as Redis from 'ioredis';
import { Service } from 'typedi';
import { environment } from '../../environment';

@Service()
export class RedisService {
    redisClient: Redis.Redis;

    constructor() {
        this.redisClient = new Redis(environment.redis as any);
    }

    async get(...args: any[]) {
        return await this.redisClient.get.apply(this.redisClient, args);
    }

    async insert(key: string, val?: string) {
      return await this.redisClient.set(key, !!val ? val : 'true', 'EX', 60);
    }
}
