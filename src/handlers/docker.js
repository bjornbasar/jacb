import http from 'node:http';

const HOSTS = {
    nalle: { hostname: '192.168.4.9', port: 2375 },
    lars:  { socketPath: '/var/run/docker.sock' },
};
const HOST_NAMES = Object.keys(HOSTS);

function dockerAPI(host, path) {
    const conn = HOSTS[host];
    if (!conn) throw new Error(`Unknown host: ${host}`);
    return new Promise((resolve, reject) => {
        const opts = { ...conn, path: `/v1.45${path}`, timeout: 5000 };
        const req = http.request(opts, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { reject(new Error(`Invalid JSON from Docker API (${host})`)); }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error(`Docker API timeout (${host})`)); });
        req.end();
    });
}

function dockerRaw(host, path, opts = {}) {
    const conn = HOSTS[host];
    if (!conn) throw new Error(`Unknown host: ${host}`);
    return new Promise((resolve, reject) => {
        const reqOpts = { ...conn, path: `/v1.45${path}`, timeout: opts.timeout || 5000, method: opts.method || 'GET' };
        const req = http.request(reqOpts, (res) => {
            if (opts.raw) {
                const chunks = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks) }));
            } else {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
            }
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error(`Timeout (${host})`)); });
        req.end();
    });
}

async function allHosts(path) {
    const results = await Promise.allSettled(
        HOST_NAMES.map(async (host) => ({ host, data: await dockerAPI(host, path) }))
    );
    return results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);
}

async function findContainer(name) {
    for (const host of HOST_NAMES) {
        try {
            const containers = await dockerAPI(host, `/containers/json?all=true&filters={"name":["${name}"]}`);
            if (containers.length) return { host, container: containers[0] };
        } catch { /* skip unreachable host */ }
    }
    return null;
}

function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default async function handleDockerCommand(args) {
    if (!args[0]) {
        return (
            'Usage:\n' +
            '/docker ps — running containers (all hosts)\n' +
            '/docker all — all containers (all hosts)\n' +
            '/docker projects — compose projects (all hosts)\n' +
            '/docker stats — resource usage (all hosts)\n' +
            '/docker logs <name> [n] — last n lines (default 20)\n' +
            '/docker restart <name> — restart container'
        );
    }

    const sub = args[0];
    const param = args[1];
    const param2 = args[2];

    try {
        if (sub === 'ps')       return await listContainers(false);
        if (sub === 'all')      return await listContainers(true);
        if (sub === 'projects') return await listProjects();
        if (sub === 'stats')    return await containerStats();
        if (sub === 'logs')    return param ? await containerLogs(param, param2) : 'Usage: /docker logs <name> [lines]';
        if (sub === 'restart') return param ? await restartContainer(param) : 'Usage: /docker restart <name>';
        return 'Unknown subcommand. Try /docker for help.';
    } catch (err) {
        console.error('Docker command error:', err.message);
        return `❌ ${err.message}`;
    }
}

async function listContainers(showAll) {
    const hostResults = await allHosts(`/containers/json?all=${showAll}`);
    if (!hostResults.length) return 'No hosts reachable.';

    const sections = [];
    let total = 0;
    for (const { host, data: containers } of hostResults) {
        if (!containers.length) continue;
        total += containers.length;
        const lines = containers.map((c) => {
            const name = c.Names[0]?.replace(/^\//, '') || c.Id.slice(0, 12);
            const state = c.State;
            const icon = state === 'running' ? '🟢' : state === 'exited' ? '🔴' : '🟡';
            return `  ${icon} *${name}* — ${c.Status}`;
        });
        sections.push(`📍 *${host}* (${containers.length})\n${lines.join('\n')}`);
    }

    if (!total) return 'No containers found.';
    return sections.join('\n\n');
}

async function listProjects() {
    const hostResults = await allHosts('/containers/json?all=true');
    if (!hostResults.length) return 'No hosts reachable.';

    const sections = [];
    for (const { host, data: containers } of hostResults) {
        const projects = new Map();
        for (const c of containers) {
            const project = c.Labels?.['com.docker.compose.project'];
            if (!project) continue;
            if (!projects.has(project)) projects.set(project, { running: 0, stopped: 0, services: [] });
            const p = projects.get(project);
            const name = c.Labels?.['com.docker.compose.service'] || c.Names[0]?.replace(/^\//, '');
            if (c.State === 'running') p.running++;
            else p.stopped++;
            p.services.push({ name, state: c.State });
        }

        const standalone = containers.filter(c => !c.Labels?.['com.docker.compose.project']);
        if (!projects.size && !standalone.length) continue;

        const lines = [];
        for (const [name, p] of [...projects.entries()].sort()) {
            const icon = p.stopped === 0 ? '🟢' : p.running === 0 ? '🔴' : '🟡';
            const svcList = p.services.map(s => {
                const si = s.state === 'running' ? '✓' : '✗';
                return `    ${si} ${s.name}`;
            }).join('\n');
            lines.push(`  ${icon} *${name}* (${p.running}/${p.running + p.stopped} up)\n${svcList}`);
        }

        if (standalone.length) {
            const svcList = standalone.map(c => {
                const name = c.Names[0]?.replace(/^\//, '') || c.Id.slice(0, 12);
                const si = c.State === 'running' ? '✓' : '✗';
                return `    ${si} ${name}`;
            }).join('\n');
            lines.push(`  📦 *standalone* (${standalone.length})\n${svcList}`);
        }

        sections.push(`📍 *${host}*\n${lines.join('\n\n')}`);
    }

    if (!sections.length) return 'No containers found.';
    return `*Compose Projects:*\n${sections.join('\n\n')}`;
}

async function containerStats() {
    const hostResults = await allHosts('/containers/json');
    if (!hostResults.length) return 'No hosts reachable.';

    const sections = [];
    for (const { host, data: containers } of hostResults) {
        if (!containers.length) continue;

        const results = await Promise.allSettled(
            containers.map(async (c) => {
                const name = c.Names[0]?.replace(/^\//, '') || c.Id.slice(0, 12);
                try {
                    const stats = await dockerAPI(host, `/containers/${c.Id}/stats?stream=false`);
                    const memUsage = stats.memory_stats?.usage || 0;
                    const memLimit = stats.memory_stats?.limit || 0;
                    const memPct = memLimit ? ((memUsage / memLimit) * 100).toFixed(1) : '?';
                    const cpuDelta = (stats.cpu_stats?.cpu_usage?.total_usage || 0) - (stats.precpu_stats?.cpu_usage?.total_usage || 0);
                    const sysDelta = (stats.cpu_stats?.system_cpu_usage || 0) - (stats.precpu_stats?.system_cpu_usage || 0);
                    const cpuCount = stats.cpu_stats?.online_cpus || 1;
                    const cpuPct = sysDelta > 0 ? ((cpuDelta / sysDelta) * cpuCount * 100).toFixed(1) : '0.0';
                    return `  *${name}*\n    CPU: ${cpuPct}% | Mem: ${formatBytes(memUsage)} / ${formatBytes(memLimit)} (${memPct}%)`;
                } catch {
                    return `  *${name}* — stats unavailable`;
                }
            })
        );

        const lines = results.map(r => r.status === 'fulfilled' ? r.value : '  ? — failed');
        sections.push(`📍 *${host}*\n${lines.join('\n')}`);
    }

    if (!sections.length) return 'No running containers.';
    return `*Resource Usage:*\n${sections.join('\n\n')}`;
}

async function containerLogs(name, lineCount) {
    const n = parseInt(lineCount) || 20;
    const found = await findContainer(name);
    if (!found) return `❌ Container "${name}" not found on any host.`;

    const { host, container } = found;
    const res = await dockerRaw(host, `/containers/${container.Id}/logs?stdout=true&stderr=true&tail=${n}`, { raw: true });

    // Docker log stream has 8-byte header per frame — strip it
    const raw = res.body;
    const lines = [];
    let offset = 0;
    while (offset + 8 <= raw.length) {
        const size = raw.readUInt32BE(offset + 4);
        if (offset + 8 + size > raw.length) break;
        lines.push(raw.subarray(offset + 8, offset + 8 + size).toString('utf8').trimEnd());
        offset += 8 + size;
    }
    if (!lines.length) return 'No logs available.';
    return `*Logs (${name}@${host}, last ${n}):*\n\`\`\`\n${lines.join('\n')}\`\`\``;
}

async function restartContainer(name) {
    const found = await findContainer(name);
    if (!found) return `❌ Container "${name}" not found on any host.`;

    const { host, container } = found;
    const res = await dockerRaw(host, `/containers/${container.Id}/restart`, { method: 'POST', timeout: 30000 });

    if (res.statusCode === 204) return `✅ *${name}* restarted on ${host}.`;
    return `⚠️ Restart returned status ${res.statusCode}`;
}
