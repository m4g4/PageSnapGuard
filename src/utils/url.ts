function url(baseUrl: string, urlPath: string) {
    if (/^https?:\/\//i.test(urlPath)) {
        return urlPath;
    }

    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    return new URL(urlPath, normalizedBaseUrl).toString();
}

function isHttpUrl(value: string): boolean {
    return /^https?:\/\//i.test(value);
}

function toAbsoluteHttpUrl(reference: string, currentUrl: string): string | null {
    try {
        const absolute = new URL(reference, currentUrl);
        if (!['http:', 'https:'].includes(absolute.protocol)) {
            return null;
        }
        return absolute.toString();
    } catch {
        return null;
    }
}

function urlToPagePath(baseUrl: URL, pageUrlRaw: string): string | null {
    let pageUrl: URL;
    try {
        pageUrl = new URL(pageUrlRaw);
    } catch {
        return null;
    }

    if (pageUrl.origin !== baseUrl.origin) {
        return null;
    }

    const basePath = baseUrl.pathname.endsWith('/') ? baseUrl.pathname : `${baseUrl.pathname}/`;
    const currentPath = pageUrl.pathname;

    if (currentPath !== baseUrl.pathname && !currentPath.startsWith(basePath)) {
        return null;
    }

    const relativePath = currentPath === baseUrl.pathname ? '' : currentPath.slice(basePath.length);
    const normalizedRelativePath = relativePath.replace(/\/+$/, '');
    return `${normalizedRelativePath}${pageUrl.search}`;
}

export { isHttpUrl, toAbsoluteHttpUrl, url, urlToPagePath };
