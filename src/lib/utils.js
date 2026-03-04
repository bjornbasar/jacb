export function sanitizeInput(text) {
    if (typeof text !== 'string') return '';
    return text.trim().substring(0, 4096);
}

export function isValidTelegramUpdate(update) {
    return !!(
        update?.message?.text &&
        update?.message?.chat?.id &&
        update?.message?.from?.id
    );
}

export function isValidMessengerEvent(event) {
    return !!(
        event?.sender?.id &&
        (event.message?.text || event.message?.quick_reply)
    );
}

export function validateEnvVars() {
    const required = ['TG_TOKEN'];
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}

// Force IPv4 — undici ignores --dns-result-order when Docker DNS returns AAAA records
import { Agent } from 'undici';
const ipv4Agent = new Agent({ connect: { family: 4 } });

export async function fetchJSON(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
        const res = await fetch(url, { ...options, signal: controller.signal, dispatcher: ipv4Agent });
        const data = await res.json().catch(() => null);
        return { ok: res.ok, status: res.status, data };
    } catch (err) {
        console.error(`HTTP request failed for ${url}:`, err.message);
        throw err;
    } finally {
        clearTimeout(timer);
    }
}
