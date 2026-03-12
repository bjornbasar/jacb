import http from 'node:http';

function dockerAPI(path) {
    return new Promise((resolve, reject) => {
        const req = http.request(
            { socketPath: '/var/run/docker.sock', path: `/v1.45${path}`, timeout: 5000 },
            (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); }
                    catch { reject(new Error('Invalid JSON from Docker API')); }
                });
            }
        );
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Docker API timeout')); });
        req.end();
    });
}

function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function ago(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
}

export default async function handleDockerCommand(args) {
    if (!args[0]) {
        return (
            'Usage:\n' +
            '/docker ps — running containers\n' +
            '/docker all — all containers\n' +
            '/docker projects — compose projects\n' +
            '/docker stats — resource usage\n' +
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
    const containers = await dockerAPI(`/containers/json?all=${showAll}`);
    if (!containers.length) return 'No containers found.';

    const lines = containers.map((c) => {
        const name = c.Names[0]?.replace(/^\//, '') || c.Id.slice(0, 12);
        const state = c.State;
        const icon = state === 'running' ? '🟢' : state === 'exited' ? '🔴' : '🟡';
        const uptime = state === 'running' ? ago(c.Created + '000') : c.Status;
        return `${icon} *${name}* — ${c.Status}`;
    });

    return `*Containers (${containers.length}):*\n${lines.join('\n')}`;
}

async function listProjects() {
    const containers = await dockerAPI('/containers/json?all=true');
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

    // Also list standalone containers (not part of compose)
    const standalone = containers.filter(c => !c.Labels?.['com.docker.compose.project']);

    if (!projects.size && !standalone.length) return 'No containers found.';

    const lines = [];
    for (const [name, p] of [...projects.entries()].sort()) {
        const icon = p.stopped === 0 ? '🟢' : p.running === 0 ? '🔴' : '🟡';
        const svcList = p.services.map(s => {
            const si = s.state === 'running' ? '✓' : '✗';
            return `  ${si} ${s.name}`;
        }).join('\n');
        lines.push(`${icon} *${name}* (${p.running}/${p.running + p.stopped} up)\n${svcList}`);
    }

    if (standalone.length) {
        const svcList = standalone.map(c => {
            const name = c.Names[0]?.replace(/^\//, '') || c.Id.slice(0, 12);
            const si = c.State === 'running' ? '✓' : '✗';
            return `  ${si} ${name}`;
        }).join('\n');
        lines.push(`📦 *standalone* (${standalone.length})\n${svcList}`);
    }

    return `*Compose Projects:*\n${lines.join('\n\n')}`;
}

async function containerStats() {
    const containers = await dockerAPI('/containers/json');
    if (!containers.length) return 'No running containers.';

    const results = await Promise.allSettled(
        containers.map(async (c) => {
            const name = c.Names[0]?.replace(/^\//, '') || c.Id.slice(0, 12);
            try {
                const stats = await dockerAPI(`/containers/${c.Id}/stats?stream=false`);
                const memUsage = stats.memory_stats?.usage || 0;
                const memLimit = stats.memory_stats?.limit || 0;
                const memPct = memLimit ? ((memUsage / memLimit) * 100).toFixed(1) : '?';
                const cpuDelta = (stats.cpu_stats?.cpu_usage?.total_usage || 0) - (stats.precpu_stats?.cpu_usage?.total_usage || 0);
                const sysDelta = (stats.cpu_stats?.system_cpu_usage || 0) - (stats.precpu_stats?.system_cpu_usage || 0);
                const cpuCount = stats.cpu_stats?.online_cpus || 1;
                const cpuPct = sysDelta > 0 ? ((cpuDelta / sysDelta) * cpuCount * 100).toFixed(1) : '0.0';
                return `*${name}*\n  CPU: ${cpuPct}% | Mem: ${formatBytes(memUsage)} / ${formatBytes(memLimit)} (${memPct}%)`;
            } catch {
                return `*${name}* — stats unavailable`;
            }
        })
    );

    const lines = results.map(r => r.status === 'fulfilled' ? r.value : '? — failed');
    return `*Resource Usage:*\n${lines.join('\n')}`;
}

async function containerLogs(name, lineCount) {
    const n = parseInt(lineCount) || 20;
    const containers = await dockerAPI(`/containers/json?all=true&filters={"name":["${name}"]}`);
    if (!containers.length) return `❌ Container "${name}" not found.`;

    const id = containers[0].Id;
    return new Promise((resolve, reject) => {
        const req = http.request(
            { socketPath: '/var/run/docker.sock', path: `/v1.45/containers/${id}/logs?stdout=true&stderr=true&tail=${n}`, timeout: 5000 },
            (res) => {
                const chunks = [];
                res.on('data', (chunk) => chunks.push(chunk));
                res.on('end', () => {
                    // Docker log stream has 8-byte header per frame — strip it
                    let raw = Buffer.concat(chunks);
                    const lines = [];
                    let offset = 0;
                    while (offset + 8 <= raw.length) {
                        const size = raw.readUInt32BE(offset + 4);
                        if (offset + 8 + size > raw.length) break;
                        lines.push(raw.slice(offset + 8, offset + 8 + size).toString('utf8').trimEnd());
                        offset += 8 + size;
                    }
                    if (!lines.length) resolve('No logs available.');
                    else resolve(`*Logs (${name}, last ${n}):*\n\`\`\`\n${lines.join('\n')}\`\`\``);
                });
            }
        );
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        req.end();
    });
}

async function restartContainer(name) {
    const containers = await dockerAPI(`/containers/json?all=true&filters={"name":["${name}"]}`);
    if (!containers.length) return `❌ Container "${name}" not found.`;

    const id = containers[0].Id;
    return new Promise((resolve, reject) => {
        const req = http.request(
            { socketPath: '/var/run/docker.sock', path: `/v1.45/containers/${id}/restart`, method: 'POST', timeout: 30000 },
            (res) => {
                if (res.statusCode === 204) resolve(`✅ *${name}* restarted.`);
                else resolve(`⚠️ Restart returned status ${res.statusCode}`);
            }
        );
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Restart timeout')); });
        req.end();
    });
}
