import { fail, redirect } from '@sveltejs/kit';
import { createCipheriv } from 'node:crypto';
import { BSJ_BASE_URL } from '$env/static/private';
import type { Actions, PageServerLoad } from './$types';

/**
 * AES-128-ECB key extracted from BSJ's frontend JS bundle. The upstream
 * encrypts the password client-side with this exact 16-byte key before
 * sending it to /webapi/user/login — we replicate that on the server so
 * the raw password never leaves this process.
 */
const BSJ_AES_KEY = Buffer.from('token=86d7423c-6');
const BSJ_QS = '__sm_ver=1.26.1,20260506100316&platform=PC&version=base';
/** 12 hours — long enough for a workday, short enough to limit blast radius. */
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

interface BsjLoginResponse {
	code: number;
	msg?: string;
	data?: {
		sid: string;
		userId: number;
		userName: string;
	};
}

function encryptPassword(password: string): string {
	const cipher = createCipheriv('aes-128-ecb', BSJ_AES_KEY, null);
	const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
	return encrypted.toString('base64');
}

/** Whitelist so `next` can't be used as an open redirect to another origin. */
function safeRedirectTarget(next: string | null | undefined): string {
	if (!next) return '/timeline';
	if (!next.startsWith('/') || next.startsWith('//')) return '/timeline';
	return next;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const next = safeRedirectTarget(url.searchParams.get('next'));
	if (locals.token) {
		throw redirect(302, next);
	}
	return { next };
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const userName = String(data.get('userName') ?? '').trim();
		const password = String(data.get('password') ?? '');
		const next = safeRedirectTarget(
			String(data.get('next') ?? '') || url.searchParams.get('next'),
		);

		if (!userName || !password) {
			return fail(400, {
				error: 'Username and password are required.',
				userName,
			});
		}

		let json: BsjLoginResponse;
		try {
			const res = await fetch(`${BSJ_BASE_URL}/webapi/user/login?${BSJ_QS}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Accept-Language': 'en',
				},
				body: JSON.stringify({
					userName,
					password: encryptPassword(password),
				}),
			});
			json = (await res.json()) as BsjLoginResponse;
		} catch {
			return fail(503, {
				error: 'Could not reach the BSJ server. Check your network and try again.',
				userName,
			});
		}

		if (json.code !== 200 || !json.data?.sid) {
			return fail(401, {
				error: json.msg ?? 'Invalid credentials.',
				userName,
			});
		}

		const session = {
			token: json.data.sid,
			userId: json.data.userId,
			userName: json.data.userName,
		};

		cookies.set('bsj_session', JSON.stringify(session), {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: SESSION_MAX_AGE_SECONDS,
			secure: url.protocol === 'https:',
		});

		throw redirect(302, next);
	},
};
