import axios from 'axios'

/**
 * Thrown when the stored Adobe session can no longer be used: the tokens are
 * missing, or Adobe rejected the refresh token. The admin has to sign in again.
 */
export class AdobeAuthError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AdobeAuthError';
    }
}

/** True for our own AdobeAuthError, or any Adobe API call rejected with 401/403. */
export const isAdobeAuthError = (err: unknown): boolean => {
    if (err instanceof AdobeAuthError) return true;

    if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        return status === 401 || status === 403;
    }

    return false;
}
