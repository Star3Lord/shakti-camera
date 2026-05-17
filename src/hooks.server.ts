import { redirect, type Handle } from '@sveltejs/kit';

interface BsjSession {
	token: string;
	userId: number;
	userName: string;
}

const PUBLIC_PATHS = ['/login'];

function isPublicPath(pathname: string): boolean {
	return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export const handle: Handle = async ({ event, resolve }) => {
	const raw = event.cookies.get('bsj_session');

	if (raw) {
		try {
			const session = JSON.parse(raw) as BsjSession;
			if (
				typeof session?.token === 'string' &&
				typeof session?.userId === 'number' &&
				typeof session?.userName === 'string'
			) {
				event.locals.token = session.token;
				event.locals.userId = session.userId;
				event.locals.userName = session.userName;
			} else {
				event.cookies.delete('bsj_session', { path: '/' });
			}
		} catch {
			event.cookies.delete('bsj_session', { path: '/' });
		}
	}

	const { pathname, search } = event.url;

	// Page navigations without a session are redirected to /login. API routes
	// instead 401 from their own handlers so fetch callers get a clean error
	// rather than an HTML redirect response.
	if (
		!event.locals.token &&
		!isPublicPath(pathname) &&
		!pathname.startsWith('/api/') &&
		!pathname.startsWith('/_app/')
	) {
		const next = encodeURIComponent(pathname + search);
		throw redirect(302, `/login?next=${next}`);
	}

	return resolve(event);
};
