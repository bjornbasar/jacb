exports.handleQuickReplyPayload = function (payload) {
    switch (payload) {
        case 'SITE':
            return '🌐 Visit my site: https://www.basar.co.nz';
        case 'PORTFOLIO':
            return '🧑‍💻 Check out my GitHub: https://github.com/bjornbasar';
        case 'EMAIL':
            return '📧 Contact me at: bjorn@basar.co.nz';
        case 'ABOUT':
            return 'I’m a dev and creative technologist. I build things across web, infra, and content.';
        default:
            return null;
    }
};

exports.keywordReply = function (text, pageId = null) {
    const lower = text.toLowerCase();

    // 🌐 Common keyword handling
    if (lower.includes('site') || lower.includes('website')) {
        return '🌐 Visit my site: https://www.basar.co.nz';
    }

    if (lower.includes('portfolio') || lower.includes('projects')) {
        return '🧑‍💻 Check out my GitHub: https://github.com/bjornbasar';
    }

    if (lower.includes('email') || lower.includes('contact')) {
        return '📧 Contact me at: bjorn@basar.co.nz';
    }

    if (lower.includes('about')) {
        return 'I’m a dev and creative technologist. I build things across web, infra, and content.';
    }

    if (lower.includes('help')) {
        return {
            text: 'Here’s what I can help you with:',
            quick_replies: [
                { content_type: 'text', title: 'Site', payload: 'SITE' },
                { content_type: 'text', title: 'Portfolio', payload: 'PORTFOLIO' },
                { content_type: 'text', title: 'Email', payload: 'EMAIL' },
                { content_type: 'text', title: 'About', payload: 'ABOUT' },
            ],
        };
    }

    // 📘 Page-specific replies
    const perPage = {
        [process.env.BASAR_FAMILY_ID]: {
            quote: '📘 Page A says: "Inspiration comes from within."',
            services: 'Page A offers consulting and creative dev services.',
        },
        [process.env.PEOPSQUIK_ID]: {
            quote: '📗 Page B reflects: "Code is poetry."',
            team: 'Our team is small, creative, and remote-first!',
        },
        [process.env.FREYA_BRYAN_ID]: {
            quote: '📗 Page B reflects: "Code is poetry."',
            team: 'Our team is small, creative, and remote-first!',
        },
    };

    const specific = perPage?.[pageId];
    if (specific) {
        for (const key in specific) {
            if (lower.includes(key)) {
                return specific[key];
            }
        }
    }

    // 🪫 No match
    return null;
};
