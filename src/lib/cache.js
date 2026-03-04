export class SimpleCache {
    constructor(ttl = 300000) {
        this.cache = new Map();
        this.ttl = ttl;
        this.timers = new Map();
    }

    set(key, value, customTtl = null) {
        const expiryTime = customTtl || this.ttl;

        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
        }

        this.cache.set(key, { value, timestamp: Date.now() });

        const timer = setTimeout(() => this.delete(key), expiryTime);
        this.timers.set(key, timer);
        return value;
    }

    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        if (Date.now() - item.timestamp > this.ttl) {
            this.delete(key);
            return null;
        }
        return item.value;
    }

    delete(key) {
        this.cache.delete(key);
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
            this.timers.delete(key);
        }
    }

    clear() {
        this.timers.forEach(timer => clearTimeout(timer));
        this.timers.clear();
        this.cache.clear();
    }

    has(key) {
        return this.cache.has(key) && this.get(key) !== null;
    }
}

export class GitHubCache extends SimpleCache {
    constructor() {
        super();
        this.ttls = {
            repo:        300000,
            runs:         60000,
            issues:      120000,
            prs:         120000,
            discussions: 300000,
            audit:       900000,
        };
    }

    setWithEndpoint(endpoint, key, value) {
        return this.set(key, value, this.ttls[endpoint] || this.ttl);
    }

    generateKey(endpoint, ...params) {
        return `${endpoint}:${params.join(':')}`;
    }
}

export const githubCache = new GitHubCache();
