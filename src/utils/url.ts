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

/**
 * Normalizes a URL for crawl uniqueness. By default every query parameter is
 * dropped so that `?a=1` and `?b=2` resolve to the same page. Params listed in
 * `keepQueryParams` are preserved because they represent distinct content
 * (e.g. pagination or product ids).
 */
function normalizeUrlQuery(pageUrl: URL, keepQueryParams: string[] = []): URL {
    const normalized = new URL(pageUrl.toString());
    normalized.hash = '';

    if (keepQueryParams.length === 0) {
        normalized.search = '';
        return normalized;
    }

    const keptParams = new URLSearchParams();
    for (const [key, value] of normalized.searchParams) {
        if (keepQueryParams.includes(key)) {
            keptParams.append(key, value);
        }
    }

    normalized.search = keptParams.toString();
    return normalized;
}

function urlToPagePath(baseUrl: URL, pageUrlRaw: string, keepQueryParams: string[] = []): string | null {
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
    const normalizedUrl = normalizeUrlQuery(pageUrl, keepQueryParams);
    return `${normalizedRelativePath}${normalizedUrl.search}`;
}

export { isHttpUrl, normalizeUrlQuery, toAbsoluteHttpUrl, url, urlToPagePath };
