import { githubCache } from '../lib/cache.js';
import { fetchJSON } from '../lib/utils.js';

export default async function handleGhCommand(args) {
    if (!args[0]) {
        return (
            'Usage:\n' +
            '/gh <repo>\n' +
            '/gh repo <owner>/<repo>\n' +
            '/gh runs <repo>\n' +
            '/gh issues <repo>\n' +
            '/gh prs <repo>\n' +
            '/gh discuss <repo>\n' +
            '/gh audit [org]'
        );
    }

    const sub = args[0];
    const param = args[1];

    try {
        if (sub === 'repo')    return param ? await fetchRepoSummary(param) : 'Usage: /gh repo <owner>/<repo>';
        if (sub === 'audit')   return await fetchAuditLog(param || 'bjornbasar');
        if (sub === 'discuss') return param ? await fetchDiscussions(param) : 'Usage: /gh discuss <repo>';
        if (sub === 'runs')    return param ? await fetchWorkflowRuns(param) : 'Usage: /gh runs <repo>';
        if (sub === 'issues')  return param ? await fetchIssues(param) : 'Usage: /gh issues <repo>';
        if (sub === 'prs')     return param ? await fetchPRs(param) : 'Usage: /gh prs <repo>';

        // default: treat first arg as repo + optional filter
        return await fetchWorkflowRun(sub, param);
    } catch (err) {
        console.error('GitHub command error:', err.message);
        return '❌ Failed to fetch GitHub data. Please try again later.';
    }
}

async function fetchRepoSummary(repo) {
    const key = githubCache.generateKey('repo', repo);
    const cached = githubCache.get(key);
    if (cached) return cached;

    const res = await fetchJSON(`https://api.github.com/repos/${repo}`, { headers: githubHeaders() });
    console.log(`GitHub repo ${repo}: ${res.status}`);
    if (!res.ok) return `❌ GitHub error: ${res.status}`;
    const r = res.data;

    const result =
        `📘 *${r.full_name}*\n` +
        (r.description ? `📝 ${r.description}\n` : '') +
        `👤 Owner: ${r.owner.login}\n` +
        `🔄 Default Branch: ${r.default_branch}\n` +
        `⭐ Stars: ${r.stargazers_count}   🍴 Forks: ${r.forks_count}   🐛 Issues: ${r.open_issues_count}\n` +
        `🆕 Created: ${new Date(r.created_at).toLocaleDateString()}   🔄 Updated: ${new Date(r.updated_at).toLocaleDateString()}\n` +
        `🔗 ${r.html_url}`;

    return githubCache.setWithEndpoint('repo', key, result);
}

async function fetchAuditLog(org) {
    const key = githubCache.generateKey('audit', org);
    const cached = githubCache.get(key);
    if (cached) return cached;

    const res = await fetchJSON(`https://api.github.com/orgs/${org}/audit-log?per_page=5`, { headers: githubHeaders(true) });
    if (res.status === 403 || res.status === 404) return `🚫 "${org}" is not a GitHub org or audit log requires Enterprise access.`;

    const logs = res.data;
    if (!Array.isArray(logs) || logs.length === 0) return `No audit logs found for ${org}.`;

    const result = `📜 Audit log for *${org}*:\n` + logs.slice(0, 3).map(e =>
        `• ${e.actor} ${e.action} on ${e.repo || e.user || 'n/a'} at ${e.created_at}`
    ).join('\n');

    return githubCache.setWithEndpoint('audit', key, result);
}

async function fetchDiscussions(repo) {
    const key = githubCache.generateKey('discussions', repo);
    const cached = githubCache.get(key);
    if (cached) return cached;

    const res = await fetchJSON(`https://api.github.com/repos/${repo}/discussions?per_page=3`, { headers: githubHeaders(true) });
    if (!res.ok) return `❌ GitHub error: ${res.status}`;
    if (!Array.isArray(res.data) || res.data.length === 0) return `No discussions found for ${repo}.`;

    const result = `🗣️ Latest discussions on *${repo}*:\n\n` + res.data.map(d =>
        `• *${d.title}* (_${d.category.name}_) by ${d.user.login}\n🔗 ${d.html_url}`
    ).join('\n\n');

    return githubCache.setWithEndpoint('discussions', key, result);
}

async function fetchWorkflowRun(repo, filter) {
    const key = githubCache.generateKey('runs', repo, filter || 'latest');
    const cached = githubCache.get(key);
    if (cached) return cached;

    const res = await fetchJSON(`https://api.github.com/repos/${repo}/actions/runs?per_page=5`, { headers: githubHeaders() });
    if (!res.ok) return `❌ GitHub error: ${res.status}`;

    let run = res.data.workflow_runs?.[0];
    if (filter) {
        run = res.data.workflow_runs?.find(r => r.name.toLowerCase().includes(filter.toLowerCase()));
    }

    if (!run) return `No recent runs found for ${repo}${filter ? ` with filter "${filter}"` : ''}.`;

    const result =
        `📦 *${run.name}* on _${repo}_\n` +
        `Status: ${run.status}\nConclusion: ${run.conclusion || 'N/A'}\n` +
        `⏱️ Triggered: ${run.run_started_at}\n🔗 ${run.html_url}`;

    return githubCache.setWithEndpoint('runs', key, result);
}

async function fetchWorkflowRuns(repo) {
    const key = githubCache.generateKey('runs', repo, 'list');
    const cached = githubCache.get(key);
    if (cached) return cached;

    const res = await fetchJSON(`https://api.github.com/repos/${repo}/actions/runs?per_page=3`, { headers: githubHeaders() });
    if (!res.ok) return `❌ GitHub error: ${res.status}`;
    if (!res.data.workflow_runs?.length) return `No runs found for ${repo}.`;

    const result = `📋 Recent workflow runs for *${repo}*:\n\n` + res.data.workflow_runs.map(r =>
        `• ${r.name} — ${r.status}/${r.conclusion || 'N/A'}\n🔗 ${r.html_url}`
    ).join('\n\n');

    return githubCache.setWithEndpoint('runs', key, result);
}

async function fetchIssues(repo) {
    const key = githubCache.generateKey('issues', repo);
    const cached = githubCache.get(key);
    if (cached) return cached;

    const res = await fetchJSON(`https://api.github.com/repos/${repo}/issues?per_page=3&state=open`, { headers: githubHeaders() });
    if (!res.ok) return `❌ GitHub error: ${res.status}`;

    const issuesOnly = res.data.filter(i => !i.pull_request);
    if (!issuesOnly.length) return `No open issues found for ${repo}.`;

    const result = `🐛 Open issues on *${repo}*:\n\n` + issuesOnly.map(i =>
        `• #${i.number}: *${i.title}* by ${i.user.login}\n🔗 ${i.html_url}`
    ).join('\n\n');

    return githubCache.setWithEndpoint('issues', key, result);
}

async function fetchPRs(repo) {
    const key = githubCache.generateKey('prs', repo);
    const cached = githubCache.get(key);
    if (cached) return cached;

    const res = await fetchJSON(`https://api.github.com/repos/${repo}/pulls?per_page=3&state=open`, { headers: githubHeaders() });
    if (!res.ok) return `❌ GitHub error: ${res.status}`;
    if (!res.data.length) return `No open pull requests found for ${repo}.`;

    const result = `📥 Open pull requests on *${repo}*:\n\n` + res.data.map(pr =>
        `• #${pr.number}: *${pr.title}* by ${pr.user.login}\n🔗 ${pr.html_url}`
    ).join('\n\n');

    return githubCache.setWithEndpoint('prs', key, result);
}

function githubHeaders(extended = false) {
    return {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        'User-Agent': 'jacb-telegram-bot',
        ...(extended && { Accept: 'application/vnd.github.v3+json' }),
    };
}
