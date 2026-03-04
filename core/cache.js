class SimpleCache {
    constructor(ttl = 300000) { // 5 minutes default TTL
        this.cache = new Map();
        this.ttl = ttl;
        this.timers = new Map();
    }

    set(key, value, customTtl = null) {
        const expiryTime = customTtl || this.ttl;
        
        // Clear existing timer if any
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
        }

        // Set the value
        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });

        // Set expiry timer
        const timer = setTimeout(() => {
            this.delete(key);
        }, expiryTime);
        
        this.timers.set(key, timer);
        return value;
    }

    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;

        const now = Date.now();
        if (now - item.timestamp > this.ttl) {
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
        // Clear all timers
        this.timers.forEach(timer => clearTimeout(timer));
        this.timers.clear();
        this.cache.clear();
    }

    has(key) {
        return this.cache.has(key) && this.get(key) !== null;
    }

    size() {
        return this.cache.size;
    }

    // Get stats for monitoring
    getStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys())
        };
    }
}

// GitHub-specific cache with different TTLs for different endpoints
class GitHubCache extends SimpleCache {
    constructor() {
        super();
        this.ttls = {
            'repo': 300000,      // 5 minutes for repo info
            'runs': 60000,       // 1 minute for workflow runs
            'issues': 120000,    // 2 minutes for issues
            'prs': 120000,       // 2 minutes for PRs
            'discussions': 300000, // 5 minutes for discussions
            'audit': 900000      // 15 minutes for audit logs
        };
    }

    setWithEndpoint(endpoint, key, value) {
        const ttl = this.ttls[endpoint] || this.ttl;
        return this.set(key, value, ttl);
    }

    generateKey(endpoint, ...params) {
        return `${endpoint}:${params.join(':')}`;
    }
}

const githubCache = new GitHubCache();

module.exports = {
    SimpleCache,
    GitHubCache,
    githubCache
};