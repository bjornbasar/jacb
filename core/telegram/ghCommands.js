module.exports = async function handleGhCommand(args) {
    if (!args[0]) {
        return 'Usage:\n' +
            '/gh <repo>\n' +
            '/gh <repo> <workflow>\n' +
            '/gh audit [org]\n' +
            '/gh discuss <repo>\n' +
            '/gh runs <repo>\n' +
            '/gh issues <repo>\n' +
            '/gh prs <repo>';
    }

    const sub = args[0];
    const param = args[1];

    if (sub === 'repo') return param ? fetchRepoSummary(param) : 'Usage: /gh repo <owner>/<repo>';
    if (sub === 'audit') return fetchAuditLog(param || 'bjornbasar');
    if (sub === 'discuss') return param ? fetchDiscussions(param) : 'Usage: /gh discuss <repo>';
    if (sub === 'runs') return param ? fetchWorkflowRuns(param) : 'Usage: /gh runs <repo>';
    if (sub === 'issues') return param ? fetchIssues(param) : 'Usage: /gh issues <repo>';
    if (sub === 'prs') return param ? fetchPRs(param) : 'Usage: /gh prs <repo>';

    // default: treat as repo status check
    return fetchWorkflowRun(sub, param);
};

async function fetchRepoSummary(repo) {
    try {
        const res = await fetch(`https://api.github.com/repos/${repo}`, {
            headers: githubHeaders()
        });

        if (!res.ok) return `❌ GitHub error: ${res.status}`;
        const r = await res.json();

        return (
            `📘 *${r.full_name}*\n` +
            (r.description ? `📝 ${r.description}\n` : '') +
            `👤 Owner: ${r.owner.login}\n` +
            `🔄 Default Branch: ${r.default_branch}\n` +
            `⭐ Stars: ${r.stargazers_count}   🍴 Forks: ${r.forks_count}   🐛 Issues: ${r.open_issues_count}\n` +
            `🆕 Created: ${new Date(r.created_at).toLocaleDateString()}   🔄 Updated: ${new Date(r.updated_at).toLocaleDateString()}\n` +
            `🔗 ${r.html_url}`
        );
    } catch (err) {
        console.error('Repo fetch error:', err);
        return '❌ Failed to fetch repository info.';
    }
}

async function fetchAuditLog(org) {
    try {
        const res = await fetch(`https://api.github.com/orgs/${org}/audit-log?per_page=5`, {
            headers: githubHeaders(true)
        });

        if (res.status === 403) {
            return `🚫 Access denied. "${org}" is not accessible or not Enterprise.`;
        }

        const logs = await res.json();
        if (!Array.isArray(logs) || logs.length === 0) return `No audit logs found for ${org}.`;

        return `📜 Audit log for *${org}*:\n` + logs.slice(0, 3).map(e =>
            `• ${e.actor} ${e.action} on ${e.repo || e.user || 'n/a'} at ${e.created_at}`
        ).join('\n');
    } catch (err) {
        console.error('Audit log error:', err);
        return '❌ Failed to fetch audit logs.';
    }
}

async function fetchDiscussions(repo) {
    try {
        const res = await fetch(`https://api.github.com/repos/${repo}/discussions?per_page=3`, {
            headers: githubHeaders(true)
        });

        if (!res.ok) return `❌ GitHub error: ${res.status}`;
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) return `No discussions found for ${repo}.`;

        return `🗣️ Latest discussions on *${repo}*:\n\n` + data.map(d =>
            `• *${d.title}* (_${d.category.name}_) by ${d.user.login}\n🔗 ${d.html_url}`
        ).join('\n\n');
    } catch (err) {
        console.error('Discussion error:', err);
        return '❌ Failed to fetch discussions.';
    }
}

async function fetchWorkflowRun(repo, filter) {
    try {
        const res = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=5`, {
            headers: githubHeaders()
        });

        if (!res.ok) return `❌ GitHub error: ${res.status}`;
        const data = await res.json();

        let run = data.workflow_runs[0];
        if (filter) {
            run = data.workflow_runs.find(r => r.name.toLowerCase().includes(filter.toLowerCase()));
        }

        if (!run) {
            const filterNote = filter ? ` with filter "${filter}"` : '';
            return `No recent runs found for ${repo}${filterNote}.`;
        }

        return `📦 *${run.name}* on _${repo}_\nStatus: ${run.status}\nConclusion: ${run.conclusion || 'N/A'}\n⏱️ Triggered: ${run.run_started_at}\n🔗 ${run.html_url}`;
    } catch (err) {
        console.error('Workflow fetch error:', err);
        return '❌ Failed to fetch workflow run.';
    }
}

async function fetchWorkflowRuns(repo) {
    try {
        const res = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=3`, {
            headers: githubHeaders()
        });

        if (!res.ok) return `❌ GitHub error: ${res.status}`;
        const data = await res.json();
        if (!data.workflow_runs?.length) return `No runs found for ${repo}.`;

        return `📋 Recent workflow runs for *${repo}*:\n\n` + data.workflow_runs.map(r =>
            `• ${r.name} — ${r.status}/${r.conclusion || 'N/A'}\n🔗 ${r.html_url}`
        ).join('\n\n');
    } catch (err) {
        console.error('Workflow runs error:', err);
        return '❌ Failed to fetch workflow runs.';
    }
}

async function fetchIssues(repo) {
    try {
        const res = await fetch(`https://api.github.com/repos/${repo}/issues?per_page=3&state=open`, {
            headers: githubHeaders()
        });

        if (!res.ok) return `❌ GitHub error: ${res.status}`;
        const data = await res.json();

        const issuesOnly = data.filter(issue => !issue.pull_request);
        if (!issuesOnly.length) return `No open issues found for ${repo}.`;

        return `🐛 Open issues on *${repo}*:\n\n` + issuesOnly.map(i =>
            `• #${i.number}: *${i.title}* by ${i.user.login}\n🔗 ${i.html_url}`
        ).join('\n\n');
    } catch (err) {
        console.error('Issues fetch error:', err);
        return '❌ Failed to fetch issues.';
    }
}

async function fetchPRs(repo) {
    try {
        const res = await fetch(`https://api.github.com/repos/${repo}/pulls?per_page=3&state=open`, {
            headers: githubHeaders()
        });

        if (!res.ok) return `❌ GitHub error: ${res.status}`;
        const data = await res.json();
        if (!data.length) return `No open pull requests found for ${repo}.`;

        return `📥 Open pull requests on *${repo}*:\n\n` + data.map(pr =>
            `• #${pr.number}: *${pr.title}* by ${pr.user.login}\n🔗 ${pr.html_url}`
        ).join('\n\n');
    } catch (err) {
        console.error('PRs fetch error:', err);
        return '❌ Failed to fetch pull requests.';
    }
}

function githubHeaders(isExtended = false) {
    return {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        'User-Agent': 'telegram-chatbot',
        ...(isExtended && { Accept: 'application/vnd.github.v3+json' })
    };
}
